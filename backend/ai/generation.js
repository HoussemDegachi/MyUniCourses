import { scrapedSections } from "../src/catalog.js";
import { callGemini } from "../src/gemini.js";
import { buildUnits, groupProblems, hitsBusy, placeable, scheduleFromUnits, sectionsOverlap } from "../src/generator.js";
import { parseInstructor, toSections } from "../src/normalize.js";
import { profMap } from "../src/profs.js";

const DAY_NAMES = { Mo: "Monday", Tu: "Tuesday", We: "Wednesday", Th: "Thursday", Fr: "Friday", Sa: "Saturday", Su: "Sunday" };

function buildPrompt(sections, courses, ratings, { userPrompt, weights, time, daysOff, includeWaitlist })
{
    const days = daysOff.length ? daysOff.map(d => `${d} (${DAY_NAMES[d] || d})`).join(", ") : "none";
    // Ratings travel in "Professor ratings" only; drop any copy left inside the sections
    const sectionJson = JSON.stringify(sections, (key, value) => (key === "rating" ? undefined : value));

    return `Build a university timetable for a University of Ottawa student from the class sections below.

        Courses to schedule: ${courses.join(", ")}

        Student preferences (weights go from 0 = does not care to 100 = very important):
        Free-text request: ${userPrompt.trim() || "none"}
        Professor rating weight: ${weights.profRating}
        Class times weight: ${weights.classTimes} (no class starting before ${time.start}, no class ending after ${time.end})
        Fewer gaps weight: ${weights.fewerGaps}
        Days off: ${days}
        Waitlisted sections allowed: ${includeWaitlist ? "yes" : "no"}

        Professor ratings: ${JSON.stringify(ratings)}

        "Professor ratings" maps an instructor name, written exactly as in the sections, to that instructor's RateMyProfessors average rating from 1 to 5 (5 = best). Instructors who are not listed, and "Staff", have no known rating.

        Sections: ${sectionJson}

        Each section above uses this format:
        {
            "term": "uoCampus term id, e.g. 2269 = 2026 Fall, 2271 = 2027 Winter",
            "course": "subject code and course number separated by a space, e.g. ITI 1521",
            "title": "course title",
            "section": "section code: a letter plus two digits, e.g. A00, A01, Z13. The letter is the section group",
            "component": "LEC (lecture), LAB (laboratory), DGD (discussion group), TUT (tutorial), SEM (seminar) or another uoCampus component code",
            "status": "Open, Closed or Wait List, as shown on uoCampus",
            "open": true if the section still has room, false if it is full,
            "meetings": [
                {
                    "days": "two-letter day codes, possibly combined: Mo, Tu, We, Th, Fr, Sa, Su (e.g. MoWe means Monday and Wednesday)",
                    "start": "start time in 24h HH:MM, null if the meeting has no set time",
                    "end": "end time in 24h HH:MM, null if the meeting has no set time",
                    "instructor": "instructor name, or Staff if not assigned yet",
                    "startDate": "first day this meeting runs, YYYY-MM-DD",
                    "endDate": "last day this meeting runs, YYYY-MM-DD"
                }
            ]
        }

        Work in this order:
        1. Look up each meeting's instructor in "Professor ratings". These ratings are for your own decision-making only: do not output them.
        2. Work out every valid combination of sections using the rules below.
        3. Score each valid combination against the student's preferences, using the ratings from step 1 for the professor rating preference.
        4. Return the best combinations as your result, in the exact format below.

        YOUR RESULT: your entire response is one JSON object with exactly this structure. Follow it strictly: the same property names, the same nesting, the same value types, every property present, and nothing added.
        {
            "schedules": [
                {
                    "rank": 1 (1 = best),
                    "overallScore": 0-100 (how well this timetable matches all preferences combined, using the weights),
                    "sections": [
                        {
                            "course": "course exactly as written in the input, e.g. ITI 1521",
                            "section": "section code exactly as written in the input, e.g. A01",
                            "component": "component exactly as written in the input, e.g. LAB"
                        }
                    ],
                    "scores": {
                        "profRating": 0-100 (how good the chosen professors are based on their ratings, 50 when ratings are unknown),
                        "classTimes": 0-100 (how well classes stay inside the start and end limits),
                        "fewerGaps": 0-100 (100 = no idle time between classes on the same day),
                        "daysOff": 0-100 (100 = no classes on any requested day off, 100 if none were requested),
                        "userRequest": 0-100 (how well it follows the free-text request, 100 if there was none)
                    },
                    "explanation": "2-3 sentences on why this timetable was chosen, including how professor ratings affected the choice",
                    "tradeoffs": ["short note for each preference this timetable could not fully satisfy"]
                }
            ],
            "warnings": ["problems such as a course that cannot be scheduled or a day off that had to be used"]
        }

        IMPORTANT:
        1. Your response is the result itself. It must be valid JSON that follows the structure above exactly. Do not add properties such as professor ratings, notes or reasoning outside "explanation", "tradeoffs" and "warnings".
        2. All property names and string values must be in double quotes.
        3. Only use the ratings in "Professor ratings". Never look up, remember, estimate or invent a rating for any instructor.
        4. To compare instructors, convert a rating to 0-100 as rating / 5 * 100 (4.9 becomes 98, 3.2 becomes 64).
        5. Treat an instructor with no rating, or "Staff", as neutral (50 out of 100), not as a bad professor.
        6. Only use sections from the list above. Copy course, section and component exactly; never invent sections.
        7. Every course in "Courses to schedule" must appear in every timetable.
        8. For each course you must choose exactly one instance of every type of component that course offers. For example, if a course has LEC and LAB sections, choose exactly one LEC and exactly one LAB; never two of the same component for the same course.
        9. All components of a course must be part of the same section: the letter of every chosen section must match the letter of the chosen lecture (LEC A00 goes with LAB A01, A02 or A03, never with LAB B01).
        10. The one exception to rule 9: some courses put a component type only in letter groups that have no lecture at all (for example LEC A00 with TUT X01, DGD Y01 and LAB Z13). Those groups are shared by every lecture, so choose one section from them regardless of the lecture letter. If a course has no LEC, treat each letter group as a complete section and pick one of each component from a single letter.
        11. No time conflicts: two meetings conflict when they share a day and their times overlap, whatever their startDate and endDate. A class ending at 11:20 and another starting at 11:30 do not conflict. Meetings with null times never conflict.
        12. Do not place any class on a day off unless no valid timetable exists without it; if you do, say so in "warnings".
        13. ${includeWaitlist ? "Sections with open = false are allowed (the student will join the waitlist), but prefer open sections when the timetables are otherwise similar and mention every full section in \"tradeoffs\"." : "Only sections with open = true are included in the list; do not ask for others."}
        14. A gap is idle time between two classes on the same day; fewer and shorter gaps are better.
        15. Use the weights to decide what matters most: a preference with weight 0 must not affect the ranking.
        16. If the free-text request asks for something specific, follow it as long as it does not break rules 6 to 11.
        17. Each timetable must differ from the others by at least one section. Return 3 timetables whenever 3 valid ones exist, fewer only if there are fewer valid options, and an empty "schedules" array plus an explanation in "warnings" if none exist.
        18. Scores must honestly reflect the timetable, not be inflated.

        DO NOT USE CODE BLOCKS AROUND THE JSON. RETURN ONLY THE CLEAN JSON OBJECT WITHOUT ANY FORMATTING OR CODE BLOCKS.
        `;
}

// "ITI 1120" -> "ITI1120", the planner's code format
const compact = code => String(code).replace(/\s+/g, "").toUpperCase();

// Checks rules 6-11 in code, since the model can't be trusted to follow them every time.
// The rules are the planner's own (src/generator.js), so this route and the planner agree
// on what a valid timetable is. eligible = what Gemini was allowed to pick; units = every
// section as the planner sees it, which defines what a complete course looks like even
// when some of its sections are full
export function validateSchedule(schedule, eligible, units, courses)
{
    const errors = [];
    const byKey = new Map(eligible.map(s => [`${compact(s.course)}|${s.section}`, s]));
    const unitsByKey = new Map(units.map(u => [u.key, u]));
    const chosen = [];
    const picked = [];

    for (const pick of schedule.sections ?? [])
    {
        const key = `${compact(pick.course)}|${pick.section}`;
        const section = byKey.get(key);
        if (!section) errors.push(`${pick.course} ${pick.section} is not in the section list`);
        else if (!chosen.includes(section))
        {
            chosen.push(section);
            // A section with no set time has no unit. It can't clash, and the planner skips it too.
            if (unitsByKey.has(key)) picked.push(unitsByKey.get(key));
        }
    }

    for (const course of courses)
    {
        const code = compact(course);
        if (units.some(u => u.courseCode === code)) errors.push(...groupProblems(code, units, picked));
        // No set times at all, like a fully online course: only check that it's there.
        else if (!chosen.some(s => compact(s.course) === code)) errors.push(`${course} is missing`);
    }

    for (let i = 0; i < picked.length; i++)
    {
        for (let j = i + 1; j < picked.length; j++)
        {
            const clash = picked[i].sections.some(a => picked[j].sections.some(b => sectionsOverlap(a, b)));
            if (clash) errors.push(`${picked[i].courseCode} ${picked[i].sectionCode} overlaps ${picked[j].courseCode} ${picked[j].sectionCode}`);
        }
    }
    return { errors, chosen };
}

// Asks Gemini for timetables and keeps every one that passes the rule check, best first.
// courseData: { "MAT 1321": [section, ...], "ITI 1120": [...] } (a flat array of sections also works)
// blocked: "ITI1120|A01" keys Gemini may not pick (full, or clashing with a busy time),
// kept apart from courseData so they still count toward what a complete course needs.
export async function pickTimetables(courseData, profRatings, { userPrompt = "", weights, time, daysOff = [], includeWaitlist = false, blocked = new Set() } = {})
{
    const options = {
        userPrompt,
        weights: { profRating: 50, classTimes: 50, fewerGaps: 50, ...weights },
        time: { start: "09:00", end: "18:00", ...time },
        daysOff,
        includeWaitlist,
    };
    const all = Array.isArray(courseData) ? courseData : Object.values(courseData ?? {}).flat();
    // Courses asked for but with no sections this term can't be scheduled; report them instead
    const notOffered = Array.isArray(courseData) ? [] : Object.keys(courseData ?? {}).filter(code => !courseData[code]?.length);
    const courses = [...new Set(all.map(s => s.course))];
    const eligible = all.filter(s => (s.open || includeWaitlist) && !blocked.has(`${compact(s.course)}|${s.section}`));
    const units = buildUnits(toSections(all));
    if (!courses.length) throw new Error("courseData is empty");

    // Only send ratings for instructors who actually teach one of the sections
    const instructors = new Set(eligible.flatMap(s => s.meetings.map(m => m.instructor)));
    const ratings = Object.fromEntries(Object.entries(profRatings ?? {})
        .filter(([name, rating]) => instructors.has(name) && typeof rating === "number"));

    const basePrompt = buildPrompt(eligible, courses, ratings, options);
    let prompt = basePrompt;
    let answer = { schedules: [], warnings: [] };
    let dropped = [];

    // Gemini ranks up to 3 timetables. Try again only if every timetable from the last answer
    // broke a rule. flash-lite gets about half its first answers wrong on a clash, so it gets
    // three tries in total.
    for (let attempt = 1; attempt <= 3; attempt++)
    {
        // Thinking high, unlike the write-ups: on flash-lite the default returned clashing
        // timetables three tries in a row, while high passed every time in testing (Sept 26,
        // four courses), at about 40 seconds a build.
        answer = await callGemini({
            user: prompt,
            json: true,
            temperature: null,
            thinking: process.env.GEMINI_BUILD_THINKING || "high",
            maxOutputTokens: null,
            timeout: 180000,
        });
        dropped = [];
        const valid = [];
        const ranked = [...(answer.schedules ?? [])].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
        for (const schedule of ranked)
        {
            const { errors, chosen } = validateSchedule(schedule, eligible, units, courses);
            if (errors.length) dropped.push(`timetable #${schedule.rank}: ${errors.join("; ")}`);
            else valid.push({ schedule, chosen });
        }
        if (valid.length)
        {
            const warnings = [...notOffered.map(code => `${code} has no sections this term, so it was left out`), ...(answer.warnings ?? [])];
            return { timetables: valid, warnings };
        }
        if (!ranked.length) break;
        prompt = `${basePrompt}
        Your previous answer broke the rules. Fix these problems:
        ${dropped.map(d => `- ${d}`).join("\n        ")}`;
    }
    const reasons = [...(answer.warnings ?? []), ...dropped];
    throw new Error(`No valid timetable${reasons.length ? `: ${reasons.join(" | ")}` : ""}`);
}

// The /api/schedules/ai route: the best timetable only, as a JSON string.
export async function generateSchedule(courseData, profRatings, userPrompt = "", weights, time, daysOff = [], includeWaitlist = false)
{
    const { timetables, warnings } = await pickTimetables(courseData, profRatings, { userPrompt, weights, time, daysOff, includeWaitlist });
    const { schedule, chosen } = timetables[0];
    return JSON.stringify({
        overallScore: schedule.overallScore,
        scores: schedule.scores,
        explanation: schedule.explanation,
        tradeoffs: schedule.tradeoffs ?? [],
        warnings,
        sections: chosen,
    }, null, 2);
}

// Each instructor's average rating, keyed by the name exactly as the sections write it,
// which is how the prompt refers to them. It's the same lookup the rest of the app uses.
export async function ratingsFor(courseData)
{
    const names = [...new Set(Object.values(courseData).flat().flatMap(s => s.meetings.map(m => m.instructor)))];
    const profs = await profMap(names.map(parseInstructor));
    const ratings = {};
    for (const name of names)
    {
        const rating = profs[parseInstructor(name)]?.rating;
        if (typeof rating === "number") ratings[name] = rating;
    }
    return ratings;
}

const DAY_CODES = { MON: "Mo", TUE: "Tu", WED: "We", THU: "Th", FRI: "Fr", SAT: "Sa", SUN: "Su" };

// The planner's Build button. Gemini picks the timetables from the student's own words and
// settings; the planner's rules check them, and they come back in the generator's shape,
// scored the same way, so the grid, swaps and write-ups work unchanged. Returns [] when
// nothing can be placed, and throws when Gemini fails, so the caller can fall back.
export async function buildSchedules({ termId, courseCodes, sections, preferences, busy = [], profs = {}, prompt = "" })
{
    const { ok, unplaced } = placeable(courseCodes, sections, preferences, busy);
    if (!ok.length) return [];

    const allowed = preferences.allowedStatus?.length ? preferences.allowedStatus : ["OPEN", "WAITLIST"];
    const blocked = new Set(sections
        .filter(s => !allowed.includes(s.status) || hitsBusy(s, busy))
        .map(s => `${s.courseCode}|${s.sectionCode}`));

    const courseData = await scrapedSections(termId, ok);
    const w = preferences.weights || {};
    const { timetables } = await pickTimetables(courseData, await ratingsFor(courseData), {
        userPrompt: prompt,
        weights: { profRating: w.prof, classTimes: w.time, fewerGaps: w.gaps },
        time: { start: preferences.earliestStart || "00:00", end: preferences.latestEnd || "23:59" },
        daysOff: (preferences.daysOff || []).map(d => DAY_CODES[d]).filter(Boolean),
        includeWaitlist: true, // status is handled by blocked, which follows the planner's own rule
        blocked,
    });

    const units = buildUnits(sections);
    const seen = new Set();
    const out = [];
    for (const { chosen } of timetables)
    {
        const keys = new Set(chosen.map(s => `${compact(s.course)}|${s.section}`));
        const picked = units.filter(u => keys.has(u.key));
        const signature = picked.map(u => u.key).sort().join(",");
        if (!picked.length || seen.has(signature)) continue;
        seen.add(signature);
        out.push({ ...scheduleFromUnits(picked, preferences, profs), id: `option-${out.length + 1}`, unplaced, builtBy: "gemini" });
    }
    return out;
}
