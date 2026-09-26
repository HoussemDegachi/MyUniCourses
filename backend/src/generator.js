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

function optionsForCourse(courseCode, units, allowedStatus, busy)
{
    const usable = units.filter(u =>
        u.courseCode === courseCode
        && allowedStatus.includes(u.status)
        && !u.sections.some(s => hitsBusy(s, busy)));

    const byGroup = new Map();
    for (const u of usable)
    {
        if (!byGroup.has(u.group)) byGroup.set(u.group, new Map());
        const byType = byGroup.get(u.group);
        byType.set(u.type, [...(byType.get(u.type) || []), u]);
    }

    const options = [];
    for (const byType of byGroup.values())
    {
        let combos = [[]];
        for (const choices of byType.values())
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

// ---------- Generation ----------

export function generateSchedules({ courseCodes, sections, preferences, busy = [], profs = {} })
{
    const units = buildUnits(sections);
    const allowedStatus = preferences.allowedStatus?.length ? preferences.allowedStatus : ["OPEN", "WAITLIST"];

    const unplaced = [];
    const perCourse = [];
    for (const code of courseCodes)
    {
        const options = optionsForCourse(code, units, allowedStatus, busy);
        if (options.length === 0) unplaced.push(code);
        else perCourse.push({ code, options });
    }

    perCourse.sort((a, b) => a.options.length - b.options.length);

    let found = search(perCourse);

    // Nothing fits. Find the one course that blocks everything and leave it out.
    if (found.length === 0 && perCourse.length > 1)
    {
        for (let i = 0; i < perCourse.length; i++)
        {
            const rest = search(perCourse.filter((_, j) => j !== i));
            if (rest.length > 0)
            {
                unplaced.push(perCourse[i].code);
                found = rest;
                break;
            }
        }
    }

    const scored = found
        .map(combo => finish(combo, preferences, profs, [...new Set(unplaced)]))
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

    return [...byLectures.values()]
        .slice(0, MAX_RESULTS)
        .map((s, i) => ({ ...s, id: `option-${i + 1}` }));
}

// Same score happens often, so break ties on things students actually feel:
// keeping requested days off, fewer days on campus, then fewer gaps.
function compare(a, b)
{
    return b.score - a.score
        || a.missedDaysOff - b.missedDaysOff
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

function finish(unitCombo, preferences, profs, unplaced)
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
        unplaced: [...unplaced],
        daysOnCampus: days.length,
        gapMinutes: totalGapMinutes(sections),
        missedDaysOff: (preferences.daysOff || []).filter(d => days.includes(d)).length,
    };
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
            if (okStart && okEnd && okDay) good++;
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
    const order = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];
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

export function scheduleFacts(schedule, best, preferences, profs)
{
    const lectures = schedule.sections.filter(s => s.type === "LEC" && s.prof && profs[s.prof]?.rating != null);
    const rated = lectures.map(s => ({ course: s.courseCode, prof: s.prof, rating: profs[s.prof].rating }));
    const average = rated.length ? Number((rated.reduce((a, r) => a + r.rating, 0) / rated.length).toFixed(1)) : null;
    const days = daysOnCampus(schedule.sections);
    const earliest = schedule.sections.reduce((m, s) => Math.min(m, toMinutes(s.start)), 24 * 60);
    const latest = schedule.sections.reduce((m, s) => Math.max(m, toMinutes(s.end)), 0);

    return {
        professors: rated,
        averageProfRating: average,
        profsWithoutRatings: schedule.sections.filter(s => s.type === "LEC" && (!s.prof || !profs[s.prof]?.rating)).map(s => s.courseCode),
        daysOnCampus: days,
        weeklyGapHours: Number((totalGapMinutes(schedule.sections) / 60).toFixed(1)),
        earliestStart: fromMinutes(earliest),
        latestEnd: fromMinutes(latest),
        componentsIncluded: [...new Set(schedule.sections.map(s => s.type))],
        waitlistedSections: schedule.sections.filter(s => s.status === "WAITLIST").map(s => `${s.courseCode} ${s.sectionCode}`),
        requestedDaysOff: preferences.daysOff || [],
        daysOffKept: (preferences.daysOff || []).filter(d => !days.includes(d)),
        requestedEarliestStart: preferences.earliestStart,
        requestedLatestEnd: preferences.latestEnd,
        weights: preferences.weights,
        score: schedule.score,
        pointsBehindBest: best ? best.score - schedule.score : 0,
        isBest: !best || schedule.id === best.id,
        coursesThatDidNotFit: schedule.unplaced,
    };
}

function fromMinutes(mins)
{
    if (!Number.isFinite(mins)) return null;
    return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
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
    if (facts.waitlistedSections.length) parts.push(`${facts.waitlistedSections.length} section${facts.waitlistedSections.length === 1 ? " is" : "s are"} waitlisted.`);
    if (!facts.isBest && facts.pointsBehindBest > 0) parts.push(`Scores ${facts.pointsBehindBest} point${facts.pointsBehindBest === 1 ? "" : "s"} below the top option.`);
    if (facts.coursesThatDidNotFit.length) parts.push(`Couldn't fit ${facts.coursesThatDidNotFit.join(", ")}.`);
    return parts.join(" ");
}
