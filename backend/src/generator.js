// Schedule generation and scoring. Everything factual the AI says comes from here.
//
// Vocabulary:
//   section  one meeting pattern (days + time) of one component
//   unit     every section sharing a course and section code, e.g. all of ITI1120 A01
//   group    the letter shared by components you must take together, e.g. A
//   option   one full way to take a course: one group, one unit per component in it

const MAX_RESULTS = 5;
const MAX_EXPLORED = 200000;
const WALKING_MINUTES = 30; // a gap shorter than this is just getting between buildings
const GAP_BUDGET = 900; // 15 hours of weekly gaps scores zero
const ALT_SCORE_SLACK = 15; // how far below the best the alternative may score

const toMinutes = t => { const [h, m] = String(t).split(":").map(Number); return h * 60 + m; };
const STATUS_RANK = { OPEN: 0, WAITLIST: 1, CLOSED: 2 };

export function sectionsOverlap(a, b)
{
    return a.days.some(d => b.days.includes(d)) && toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);
}

export function hitsBusy(section, busy)
{
    return busy.some(b => section.days.includes(b.day)
        && toMinutes(section.start) < toMinutes(b.end)
        && toMinutes(b.start) < toMinutes(section.end));
}

// ---------- Units ----------

export function buildUnits(sections)
{
    const map = new Map();
    for (const s of sections)
    {
        const key = `${s.courseCode}|${s.sectionCode}`;
        let unit = map.get(key);
        if (!unit)
        {
            unit = { key, courseCode: s.courseCode, sectionCode: s.sectionCode, group: s.group, type: s.type, status: s.status, sections: [] };
            map.set(key, unit);
        }
        unit.sections.push(s);
        if (STATUS_RANK[s.status] > STATUS_RANK[unit.status]) unit.status = s.status;
    }
    // A unit that clashes with itself is bad scraper data. Drop it rather than crash.
    return [...map.values()].filter(u => !u.sections.some((a, i) => u.sections.slice(i + 1).some(b => sectionsOverlap(a, b))));
}

// Groups come in two kinds. A group with a lecture (A00 LEC, A01 DGD, A02 LAB) is a
// complete way to take the course. A group with no lecture (PHY1731's X01 TUT, Y01 DGD,
// Z13 LAB) is shared: it serves every lecture group. So an option is one lecture group
// with one unit of each of its components, plus one unit of each component that only
// the shared groups offer. A course with no lecture at all treats every group as complete.
function completeGroups(course)
{
    const hasLecture = course.some(u => u.type === "LEC");
    return new Set(course.filter(u => !hasLecture || u.type === "LEC").map(u => u.group));
}

// Taking the course through this complete group: the units that can fill each component
// it needs. Which components are required comes from everything offered, not just what
// is open: a group whose only DGDs are full can't be taken without a DGD.
function slotsFor(course, group, complete)
{
    const ownTypes = new Set(course.filter(u => u.group === group).map(u => u.type));
    const slots = [...ownTypes].map(type => course.filter(u => u.group === group && u.type === type));
    const sharedTypes = new Set(course.filter(u => !complete.has(u.group) && !ownTypes.has(u.type)).map(u => u.type));
    for (const type of sharedTypes) slots.push(course.filter(u => !complete.has(u.group) && u.type === type));
    return slots;
}

function optionsForCourse(courseCode, units, allowedStatus, busy)
{
    const course = units.filter(u => u.courseCode === courseCode);
    const complete = completeGroups(course);
    const usable = u => allowedStatus.includes(u.status) && !u.sections.some(s => hitsBusy(s, busy));

    const options = [];
    for (const group of complete)
    {
        const choicesByType = slotsFor(course, group, complete).map(slot => slot.filter(usable));
        if (choicesByType.some(choices => choices.length === 0)) continue;

        let combos = [[]];
        for (const choices of choicesByType)
        {
            combos = combos.flatMap(combo => choices.map(c => [...combo, c]));
            if (combos.length > 400) combos = combos.slice(0, 400);
        }
        for (const combo of combos)
        {
            const all = combo.flatMap(u => u.sections);
            if (all.some((a, i) => all.slice(i + 1).some(b => sectionsOverlap(a, b)))) continue;
            options.push(combo);
        }
    }
    return options;
}

// Why units picked by hand are not one valid way to take the course, or [] when they are.
// Same group rules as optionsForCourse; overlaps are the caller's to check. The AI route
// uses this on Gemini's answers, so both agree on what a valid timetable is.
export function groupProblems(courseCode, units, picked)
{
    const course = units.filter(u => u.courseCode === courseCode);
    const mine = picked.filter(u => u.courseCode === courseCode);
    if (!mine.length) return [`${courseCode} is missing`];

    const complete = completeGroups(course);
    const groups = [...new Set(mine.map(u => u.group).filter(g => complete.has(g)))];
    if (groups.length !== 1)
    {
        return [`${courseCode} mixes sections ${groups.join(", ") || "without a lecture"}; all components must share one section letter`];
    }

    const problems = [];
    const slots = slotsFor(course, groups[0], complete);
    for (const slot of slots)
    {
        const count = mine.filter(u => slot.includes(u)).length;
        if (count !== 1) problems.push(`${courseCode} needs exactly one ${slot[0].type}, got ${count}`);
    }
    for (const u of mine)
    {
        if (!slots.some(slot => slot.includes(u))) problems.push(`${courseCode} ${u.sectionCode} (${u.type}) is not part of section ${groups[0]}`);
    }
    return problems;
}

// ---------- Generation ----------

export function generateSchedules({ courseCodes, sections, preferences, busy = [], profs = {} })
{
    const units = buildUnits(sections);
    const allowedStatus = preferences.allowedStatus?.length ? preferences.allowedStatus : ["OPEN", "WAITLIST"];

    const unplaced = [];
    const perCourse = [];
    for (const code of [...new Set(courseCodes)])
    {
        const options = optionsForCourse(code, units, allowedStatus, busy);
        if (options.length === 0) unplaced.push(whyNoOptions(code, units, allowedStatus, busy));
        else perCourse.push({ code, options });
    }

    perCourse.sort((a, b) => a.options.length - b.options.length);

    let found = search(perCourse);
    let blocked = null;

    // Nothing fits. Find the one course that blocks everything and leave it out.
    if (found.length === 0 && perCourse.length > 1)
    {
        for (let i = 0; i < perCourse.length; i++)
        {
            const rest = search(perCourse.filter((_, j) => j !== i));
            if (rest.length > 0)
            {
                blocked = perCourse[i];
                found = rest;
                break;
            }
        }
    }

    const scored = found
        .map(combo => finish(combo, preferences, profs))
        .sort(compare);

    // Options that differ only by which DGD you take aren't real choices, and five
    // near-identical tabs are worse than three distinct ones. Keep the best schedule
    // per set of lectures; swapping a lab or DGD is a separate, smaller decision.
    const byLectures = new Map();
    for (const schedule of scored)
    {
        const key = schedule.units.filter(u => u.type === "LEC").map(u => `${u.courseCode}|${u.sectionCode}`).sort().join(",");
        if (!byLectures.has(key)) byLectures.set(key, schedule);
    }

    // A blocked course clashes with different things depending on how the rest is
    // arranged, so each schedule names what it overlaps in that schedule.
    return withAlternativeSecond([...byLectures.values()])
        .slice(0, MAX_RESULTS)
        .map((s, i) => ({
            ...s,
            id: `option-${i + 1}`,
            unplaced: blocked
                ? [...unplaced, { courseCode: blocked.code, reason: "CLASH", conflictsWith: overlappedCourses(blocked.options, s.sections) }]
                : unplaced,
        }));
}

// Courses with at least one way to take them under these preferences and busy times,
// and why the rest can't be placed. Gemini is only asked about the placeable ones.
export function placeable(courseCodes, sections, preferences, busy = [])
{
    const units = buildUnits(sections);
    const allowedStatus = preferences.allowedStatus?.length ? preferences.allowedStatus : ["OPEN", "WAITLIST"];
    const ok = [];
    const unplaced = [];
    for (const code of [...new Set(courseCodes)])
    {
        if (optionsForCourse(code, units, allowedStatus, busy).length) ok.push(code);
        else unplaced.push(whyNoOptions(code, units, allowedStatus, busy));
    }
    return { ok, unplaced };
}

// A schedule in the usual shape from units picked elsewhere (by Gemini), scored exactly
// like the generator's own.
export function scheduleFromUnits(units, preferences, profs)
{
    return finish(units, preferences, profs);
}

// Checked in the same order the filters run, so the first one that empties the
// list is the reason.
function whyNoOptions(code, units, allowedStatus, busy)
{
    const result = (reason, conflictsWith = []) => ({ courseCode: code, reason, conflictsWith });

    const mine = units.filter(u => u.courseCode === code);
    if (!mine.length) return result("NOT_OFFERED");

    const allowed = mine.filter(u => allowedStatus.includes(u.status));
    if (!allowed.length)
    {
        const waitlisted = mine.some(u => u.status === "WAITLIST") && !allowedStatus.includes("WAITLIST");
        return result(waitlisted ? "WAITLIST_ONLY" : "FULL");
    }

    if (optionsForCourse(code, units, allowedStatus, []).length)
    {
        const titles = busy
            .filter(b => allowed.some(u => u.sections.some(s => hitsBusy(s, [b]))))
            .map(b => b.title || "a busy block");
        return result("BUSY", [...new Set(titles)]);
    }

    // Its own components never line up without overlapping each other.
    return result("CLASH");
}

function overlappedCourses(options, sections)
{
    const hit = new Set();
    for (const option of options)
    {
        for (const s of option.flatMap(u => u.sections))
        {
            for (const other of sections) if (sectionsOverlap(s, other)) hit.add(other.courseCode);
        }
    }
    return [...hit].sort();
}

// The second slot is the alternative. The runner-up is usually the best schedule
// with one lecture moved, which is not a real choice. Instead take the schedule
// that shares the fewest units with the best, among those that still score close
// and keep every day off the best one keeps.
function withAlternativeSecond(ranked)
{
    if (ranked.length < 3) return ranked;
    const [best, ...rest] = ranked;
    const bestKeys = new Set(best.units.map(u => u.key));

    let pick = null;
    let pickDiff = -1;
    for (const s of rest)
    {
        if (s.score < best.score - ALT_SCORE_SLACK || s.missedDaysOff > best.missedDaysOff) continue;
        const diff = s.units.filter(u => !bestKeys.has(u.key)).length / s.units.length;
        // rest is already ranked, so strictly greater keeps the higher score on ties.
        if (diff > pickDiff)
        {
            pick = s;
            pickDiff = diff;
        }
    }

    if (!pick) return ranked;
    return [best, pick, ...rest.filter(s => s !== pick)];
}

// Same score happens often, so break ties on things students actually feel:
// keeping requested days off and free times, fewer days on campus, then fewer gaps.
function compare(a, b)
{
    return b.score - a.score
        || a.missedDaysOff - b.missedDaysOff
        || a.missedFreeTimes - b.missedFreeTimes
        || a.daysOnCampus - b.daysOnCampus
        || a.gapMinutes - b.gapMinutes;
}

function search(perCourse)
{
    const found = [];
    let explored = 0;

    const walk = (i, picked, pickedSections) =>
    {
        if (explored++ > MAX_EXPLORED || found.length > 4000) return;
        if (i === perCourse.length)
        {
            found.push(picked);
            return;
        }
        for (const option of perCourse[i].options)
        {
            const sections = option.flatMap(u => u.sections);
            if (sections.some(s => pickedSections.some(p => sectionsOverlap(s, p)))) continue;
            walk(i + 1, [...picked, ...option], [...pickedSections, ...sections]);
        }
    };

    walk(0, [], []);
    return found;
}

function finish(unitCombo, preferences, profs)
{
    const sections = unitCombo.flatMap(u => u.sections);
    const breakdown = scoreBreakdown(sections, preferences, profs);
    const w = preferences.weights || { prof: 50, time: 50, gaps: 50 };
    const total = (w.prof + w.time + w.gaps) || 1;
    const score = Math.round(((breakdown.prof * w.prof + breakdown.time * w.time + breakdown.gaps * w.gaps) / total) * 100);

    const days = daysOnCampus(sections);

    return {
        id: "",
        sections,
        units: unitCombo.map(u => ({ key: u.key, courseCode: u.courseCode, sectionCode: u.sectionCode, group: u.group, type: u.type, status: u.status })),
        score,
        breakdown,
        unplaced: [],
        daysOnCampus: days.length,
        gapMinutes: totalGapMinutes(sections),
        missedDaysOff: (preferences.daysOff || []).filter(d => days.includes(d)).length,
        missedFreeTimes: (preferences.freeTimes || []).filter(f => sections.some(s => inFreeTime(s, f.day, [f]))).length,
    };
}

// True when a class on this day runs into one of the times the student wants kept free,
// like "Friday afternoon for clubs". Soft, like daysOff: it lowers the time score.
export function inFreeTime(section, day, freeTimes)
{
    return freeTimes.some(f => f.day === day
        && section.days.includes(day)
        && toMinutes(section.start) < toMinutes(f.end)
        && toMinutes(f.start) < toMinutes(section.end));
}

// ---------- Scoring ----------

export function scoreBreakdown(sections, preferences, profs)
{
    const lectures = sections.filter(s => s.type === "LEC");
    const ratings = lectures.map(s => (s.prof && profs[s.prof]?.rating != null ? (profs[s.prof].rating - 1) / 4 : 0.5));
    const prof = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0.5;

    let meetings = 0;
    let good = 0;
    for (const s of sections)
    {
        for (const d of s.days)
        {
            meetings++;
            const okStart = !preferences.earliestStart || toMinutes(s.start) >= toMinutes(preferences.earliestStart);
            const okEnd = !preferences.latestEnd || toMinutes(s.end) <= toMinutes(preferences.latestEnd);
            const okDay = !(preferences.daysOff || []).includes(d);
            const okFree = !inFreeTime(s, d, preferences.freeTimes || []);
            if (okStart && okEnd && okDay && okFree) good++;
        }
    }
    const time = meetings ? good / meetings : 1;
    const gaps = Math.max(0, 1 - totalGapMinutes(sections) / GAP_BUDGET);

    return { prof, time, gaps };
}

export function totalGapMinutes(sections)
{
    const byDay = new Map();
    for (const s of sections)
    {
        for (const d of s.days) byDay.set(d, [...(byDay.get(d) || []), [toMinutes(s.start), toMinutes(s.end)]]);
    }
    let total = 0;
    for (const blocks of byDay.values())
    {
        blocks.sort((a, b) => a[0] - b[0]);
        for (let i = 1; i < blocks.length; i++)
        {
            const gap = blocks[i][0] - blocks[i - 1][1];
            if (gap > WALKING_MINUTES) total += gap;
        }
    }
    return total;
}

export function daysOnCampus(sections)
{
    const order = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
    const used = new Set(sections.flatMap(s => s.days));
    return order.filter(d => used.has(d));
}

// ---------- Alternatives ----------

// Other times you could take one component without breaking the rest of the schedule.
// Same course, same group, same component, no clash with anything else you picked.
export function alternativesFor({ unitKey, schedule, sections, allowedStatus, busy = [] })
{
    const units = buildUnits(sections);
    const current = units.find(u => u.key === unitKey);
    if (!current) return [];

    const keptSections = schedule.sections.filter(s => `${s.courseCode}|${s.sectionCode}` !== unitKey);

    return units
        .filter(u => u.key !== unitKey
            && u.courseCode === current.courseCode
            && u.group === current.group
            && u.type === current.type
            && allowedStatus.includes(u.status)
            && !u.sections.some(s => hitsBusy(s, busy))
            && !u.sections.some(s => keptSections.some(k => sectionsOverlap(s, k))))
        .map(u => ({ key: u.key, sectionCode: u.sectionCode, type: u.type, status: u.status, sections: u.sections }));
}

// ---------- Facts for the explanation prompt ----------

const EARLY = 9 * 60; // a class starting before 9:00 counts as early
const LATE = 18 * 60; // a class ending after 18:00 counts as late
const hours = mins => Number((mins / 60).toFixed(1));

function averageRating(sections, profs)
{
    const ratings = sections.filter(s => s.type === "LEC" && s.prof && profs[s.prof]?.rating != null).map(s => profs[s.prof].rating);
    return ratings.length ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)) : null;
}

// One row per day on campus: when it starts and ends, and how much of it is waiting.
export function weekBreakdown(sections)
{
    return daysOnCampus(sections).map(day =>
    {
        const today = sections.filter(s => s.days.includes(day));
        const first = Math.min(...today.map(s => toMinutes(s.start)));
        const last = Math.max(...today.map(s => toMinutes(s.end)));
        return {
            day,
            firstStart: fromMinutes(first),
            lastEnd: fromMinutes(last),
            hoursOnCampus: hours(last - first),
            classes: today.length,
            gapHours: hours(totalGapMinutes(today)),
        };
    });
}

export function scheduleFacts(schedule, best, preferences, profs)
{
    const lectures = schedule.sections.filter(s => s.type === "LEC" && s.prof && profs[s.prof]?.rating != null);
    const rated = lectures.map(s => ({
        course: s.courseCode,
        prof: s.prof,
        rating: profs[s.prof].rating,
        difficulty: profs[s.prof].difficulty ?? null,
        wouldTakeAgainPercent: profs[s.prof].wouldTakeAgain ?? null,
        numRatings: profs[s.prof].numRatings ?? null,
    }));
    const average = averageRating(schedule.sections, profs);
    const days = daysOnCampus(schedule.sections);
    const earliest = schedule.sections.reduce((m, s) => Math.min(m, toMinutes(s.start)), 24 * 60);
    const latest = schedule.sections.reduce((m, s) => Math.max(m, toMinutes(s.end)), 0);
    const week = weekBreakdown(schedule.sections);
    const longest = week.reduce((a, d) => (!a || d.hoursOnCampus > a.hoursOnCampus ? d : a), null);
    const meetings = schedule.sections.flatMap(s => s.days.map(day => ({ s, day })));
    const label = ({ s, day }) => `${s.courseCode} ${s.type} ${day} ${s.start}-${s.end}`;
    const isBest = !best || schedule.id === best.id;
    const freeTimes = preferences.freeTimes || [];
    const freeLabel = f => `${f.day} ${f.start}-${f.end}`;

    return {
        professors: rated,
        averageProfRating: average,
        profsWithoutRatings: schedule.sections.filter(s => s.type === "LEC" && (!s.prof || !profs[s.prof]?.rating)).map(s => s.courseCode),
        daysOnCampus: days,
        weeklyGapHours: Number((totalGapMinutes(schedule.sections) / 60).toFixed(1)),
        earliestStart: fromMinutes(earliest),
        latestEnd: fromMinutes(latest),
        week,
        longestDay: longest,
        earlyClasses: meetings.filter(m => toMinutes(m.s.start) < EARLY).map(label),
        lateClasses: meetings.filter(m => toMinutes(m.s.end) > LATE).map(label),
        classesBeforeRequestedStart: preferences.earliestStart
            ? meetings.filter(m => toMinutes(m.s.start) < toMinutes(preferences.earliestStart)).map(label)
            : [],
        classesAfterRequestedEnd: preferences.latestEnd
            ? meetings.filter(m => toMinutes(m.s.end) > toMinutes(preferences.latestEnd)).map(label)
            : [],
        componentsIncluded: [...new Set(schedule.sections.map(s => s.type))],
        waitlistedSections: schedule.sections.filter(s => s.status === "WAITLIST").map(s => `${s.courseCode} ${s.sectionCode}`),
        requestedDaysOff: preferences.daysOff || [],
        daysOffKept: (preferences.daysOff || []).filter(d => !days.includes(d)),
        // Parts of a day kept free ("Friday afternoon"), and the classes that land in any that aren't.
        requestedFreeTimes: freeTimes.map(freeLabel),
        freeTimesKept: freeTimes.filter(f => !schedule.sections.some(s => inFreeTime(s, f.day, [f]))).map(freeLabel),
        freeTimesMissed: freeTimes
            .map(f => ({ ...f, classes: meetings.filter(m => m.day === f.day && inFreeTime(m.s, f.day, [f])).map(label) }))
            .filter(m => m.classes.length),
        requestedEarliestStart: preferences.earliestStart,
        requestedLatestEnd: preferences.latestEnd,
        weights: preferences.weights,
        score: schedule.score,
        pointsBehindBest: best ? best.score - schedule.score : 0,
        isBest,
        comparedWithBest: isBest ? null : {
            score: best.score,
            averageProfRating: averageRating(best.sections, profs),
            daysOnCampus: daysOnCampus(best.sections).length,
            weeklyGapHours: hours(totalGapMinutes(best.sections)),
        },
        coursesThatDidNotFit: schedule.unplaced,
    };
}

function fromMinutes(mins)
{
    if (!Number.isFinite(mins)) return null;
    return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

// Strengths and trade-offs without the AI. Same facts, fixed wording.
export function describeDetails(facts)
{
    const strengths = [];
    const tradeoffs = [];
    const list = items => (items.length <= 2 ? items.join(" and ") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);
    const day = { MON: "Monday", TUE: "Tuesday", WED: "Wednesday", THU: "Thursday", FRI: "Friday", SAT: "Saturday", SUN: "Sunday" };
    const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
    // "13:30" -> "1:30 PM", matching how the app shows times everywhere else.
    const clock = t =>
    {
        const m = toMinutes(t);
        const h = Math.floor(m / 60) % 12 || 12;
        return `${h}${m % 60 ? `:${String(m % 60).padStart(2, "0")}` : ""} ${m >= 720 ? "PM" : "AM"}`;
    };

    const byRating = [...facts.professors].sort((a, b) => b.rating - a.rating);
    if (facts.averageProfRating != null && facts.averageProfRating >= 4)
    {
        strengths.push(`Strong professors, averaging ${facts.averageProfRating} out of 5. ${byRating[0].prof} (${byRating[0].rating}) teaches ${byRating[0].course}.`);
    }
    const weak = byRating.filter(p => p.rating < 3);
    if (weak.length) tradeoffs.push(`${list(weak.map(p => `${p.prof} (${p.rating}) for ${p.course}`))} ${weak.length === 1 ? "is" : "are"} rated below 3 out of 5.`);

    const n = facts.daysOnCampus.length;
    if (n <= 3) strengths.push(`Only ${plural(n, "day", "days")} on campus a week.`);
    if (facts.weeklyGapHours < 1) strengths.push("Almost no waiting between classes.");
    else if (facts.weeklyGapHours >= 4) tradeoffs.push(`About ${Math.round(facts.weeklyGapHours)} hours a week spent waiting between classes.`);

    if (facts.longestDay && facts.longestDay.hoursOnCampus >= 8)
    {
        const d = facts.longestDay;
        tradeoffs.push(`${day[d.day]} is long: ${clock(d.firstStart)} to ${clock(d.lastEnd)}, ${d.hoursOnCampus} hours on campus.`);
    }

    if (facts.requestedDaysOff.length)
    {
        const missed = facts.requestedDaysOff.filter(d => !facts.daysOffKept.includes(d));
        if (!missed.length) strengths.push(`Keeps ${list(facts.requestedDaysOff.map(d => day[d]))} free, as you asked.`);
        else tradeoffs.push(`Has classes on ${list(missed.map(d => day[d]))}, which you wanted off.`);
    }
    if (facts.requestedFreeTimes.length)
    {
        if (!facts.freeTimesMissed.length) strengths.push("Keeps the time you wanted free, as you asked.");
        for (const m of facts.freeTimesMissed)
        {
            tradeoffs.push(`${list(m.classes)} ${m.classes.length === 1 ? "falls" : "fall"} in ${day[m.day]} ${clock(m.start)} to ${clock(m.end)}, which you wanted free.`);
        }
    }
    if (facts.classesBeforeRequestedStart.length) tradeoffs.push(`${plural(facts.classesBeforeRequestedStart.length, "class starts", "classes start")} before ${clock(facts.requestedEarliestStart)}.`);
    else if (facts.requestedEarliestStart) strengths.push(`Nothing starts before ${clock(facts.requestedEarliestStart)}.`);
    if (facts.classesAfterRequestedEnd.length) tradeoffs.push(`${plural(facts.classesAfterRequestedEnd.length, "class ends", "classes end")} after ${clock(facts.requestedLatestEnd)}.`);

    if (facts.waitlistedSections.length) tradeoffs.push(`Waitlisted: ${list(facts.waitlistedSections)}. You may not get a seat.`);
    else strengths.push("Every section has open seats.");

    if (!facts.isBest && facts.pointsBehindBest > 0) tradeoffs.push(`Scores ${plural(facts.pointsBehindBest, "point", "points")} below your best match.`);

    return { strengths: strengths.slice(0, 4), tradeoffs: tradeoffs.slice(0, 4) };
}

// Used when Gemini is unavailable, and as the no-AI fallback.
export function describeSchedule(facts)
{
    const parts = [];
    if (facts.averageProfRating != null)
    {
        const top = [...facts.professors].sort((a, b) => b.rating - a.rating)[0];
        parts.push(`Your profs average ${facts.averageProfRating} out of 5, with ${top.prof} (${top.rating}) for ${top.course}.`);
    }
    const n = facts.daysOnCampus.length;
    parts.push(`You're on campus ${n} day${n === 1 ? "" : "s"} a week${facts.weeklyGapHours >= 1 ? ` with about ${Math.round(facts.weeklyGapHours)} hours of gaps between classes` : " with almost no gaps"}.`);
    if (facts.requestedDaysOff.length)
    {
        const kept = facts.daysOffKept;
        parts.push(kept.length === facts.requestedDaysOff.length ? "It keeps the days off you asked for." : "It doesn't keep every day off you asked for.");
    }
    if (facts.requestedFreeTimes.length)
    {
        parts.push(facts.freeTimesMissed.length ? "It doesn't keep all the time you asked to keep free." : "It keeps the times you asked to keep free.");
    }
    if (facts.waitlistedSections.length) parts.push(`${facts.waitlistedSections.length} section${facts.waitlistedSections.length === 1 ? " is" : "s are"} waitlisted.`);
    if (!facts.isBest && facts.pointsBehindBest > 0) parts.push(`Scores ${facts.pointsBehindBest} point${facts.pointsBehindBest === 1 ? "" : "s"} below the top option.`);
    if (facts.coursesThatDidNotFit.length) parts.push(`Couldn't fit ${facts.coursesThatDidNotFit.map(u => u.courseCode).join(", ")}.`);
    return parts.join(" ");
}
