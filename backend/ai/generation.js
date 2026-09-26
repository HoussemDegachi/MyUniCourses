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
        11. No time conflicts: two meetings conflict when they share a day, their times overlap, and their startDate-endDate ranges overlap. A class ending at 11:20 and another starting at 11:30 do not conflict. Meetings with null times never conflict.
        12. Do not place any class on a day off unless no valid timetable exists without it; if you do, say so in "warnings".
        13. ${includeWaitlist ? "Sections with open = false are allowed (the student will join the waitlist), but prefer open sections when the timetables are otherwise similar and mention every full section in \"tradeoffs\"." : "Only sections with open = true are included in the list; do not ask for others."}
        14. A gap is idle time between two classes on the same day; fewer and shorter gaps are better.
        15. Use the weights to decide what matters most: a preference with weight 0 must not affect the ranking.
        16. If the free-text request asks for something specific, follow it as long as it does not break rules 6 to 11.
        17. Each timetable must differ from the others by at least one section. Return fewer than 3 if there are fewer valid options, and an empty "schedules" array plus an explanation in "warnings" if none exist.
        18. Scores must honestly reflect the timetable, not be inflated.

        DO NOT USE CODE BLOCKS AROUND THE JSON. RETURN ONLY THE CLEAN JSON OBJECT WITHOUT ANY FORMATTING OR CODE BLOCKS.
        `;
}

async function askGemini(prompt)
{
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not set (get a free key at https://aistudio.google.com/apikey)");
    const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    // 503 means Gemini is busy right now; wait a bit and try again
    for (let attempt = 1; ; attempt++)
    {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" },
            }),
        });
        const body = await res.json();
        if (res.status === 503 && attempt < 3)
        {
            await new Promise(resolve => setTimeout(resolve, 5000));
            continue;
        }
        if (!res.ok) throw new Error(`Gemini ${res.status}: ${body.error?.message || "request failed"}`);

        const text = (body.candidates?.[0]?.content?.parts ?? []).map(part => part.text || "").join("");
        // Strip a stray code fence in case the model adds one anyway
        return JSON.parse(text.replace(/^\s*```(?:json)?\s*/, "").replace(/\s*```\s*$/, ""));
    }
}

function minutes(hhmm)
{
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
}

function dayCodes(days)
{
    return days.match(/Mo|Tu|We|Th|Fr|Sa|Su/g) ?? [];
}

function meetingsConflict(a, b)
{
    if (!a.start || !b.start) return false;
    if (!dayCodes(a.days).some(d => dayCodes(b.days).includes(d))) return false;
    if (a.startDate && b.startDate && (a.endDate < b.startDate || b.endDate < a.startDate)) return false;
    return minutes(a.start) < minutes(b.end) && minutes(b.start) < minutes(a.end);
}

// Checks rules 6-11 in code, since the model can't be trusted to follow them every time.
// eligible = what Gemini was allowed to pick; all = every section, which defines what a
// complete course looks like even when some of its sections are full
export function validateSchedule(schedule, eligible, all, courses)
{
    const errors = [];
    const byKey = new Map(eligible.map(s => [`${s.course}|${s.section}`, s]));
    const chosen = [];

    for (const pick of schedule.sections ?? [])
    {
        const section = byKey.get(`${pick.course}|${pick.section}`);
        if (!section) errors.push(`${pick.course} ${pick.section} is not in the section list`);
        else chosen.push(section);
    }

    for (const course of courses)
    {
        const offered = all.filter(s => s.course === course);
        const picked = chosen.filter(s => s.course === course);
        if (!picked.length)
        {
            errors.push(`${course} is missing`);
            continue;
        }

        const letter = s => s.section[0];
        const hasLecture = offered.some(s => s.component === "LEC");
        const anchored = new Set(offered.filter(s => !hasLecture || s.component === "LEC").map(letter));
        const anchorPicks = [...new Set(picked.map(letter).filter(l => anchored.has(l)))];
        if (anchorPicks.length !== 1)
        {
            errors.push(`${course} mixes sections ${anchorPicks.join(", ") || "without a lecture"}; all components must share one section letter`);
            continue;
        }

        // Types the chosen letter offers, plus types only offered in lecture-less (shared) groups
        const own = offered.filter(s => letter(s) === anchorPicks[0]);
        const shared = offered.filter(s => !anchored.has(letter(s)));
        const required = new Set([...own, ...shared].map(s => s.component));
        for (const component of required)
        {
            const count = picked.filter(s => s.component === component).length;
            if (count !== 1) errors.push(`${course} needs exactly one ${component}, got ${count}`);
        }
        for (const s of picked)
        {
            const allowed = letter(s) === anchorPicks[0] || (!anchored.has(letter(s)) && !own.some(o => o.component === s.component));
            if (!allowed) errors.push(`${course} ${s.section} (${s.component}) is not part of section ${anchorPicks[0]}`);
        }
    }

    for (let i = 0; i < chosen.length; i++)
    {
        for (let j = i + 1; j < chosen.length; j++)
        {
            const clash = chosen[i].meetings.some(a => chosen[j].meetings.some(b => meetingsConflict(a, b)));
            if (clash) errors.push(`${chosen[i].course} ${chosen[i].section} overlaps ${chosen[j].course} ${chosen[j].section}`);
        }
    }
    return { errors, chosen };
}

// courseData: { "MAT 1321": [section, ...], "ITI 1120": [...] } (a flat array of sections also works)
export async function generateSchedule(courseData, profRatings, userPrompt = "", weights, time, daysOff = [], includeWaitlist = false)
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
    const eligible = all.filter(s => s.open || includeWaitlist);

    // Only send ratings for instructors who actually teach one of the sections
    const instructors = new Set(eligible.flatMap(s => s.meetings.map(m => m.instructor)));
    const ratings = Object.fromEntries(Object.entries(profRatings ?? {})
        .filter(([name, rating]) => instructors.has(name) && typeof rating === "number"));

    const basePrompt = buildPrompt(eligible, courses, ratings, options);
    let prompt = basePrompt;
    let answer = { schedules: [], warnings: [] };
    let dropped = [];
    if (!courses.length) throw new Error("courseData is empty");

    // Gemini ranks up to 3 timetables; the best-ranked one that passes the rule check wins.
    // Second try only if every timetable from the first one broke a rule
    for (let attempt = 1; attempt <= 2; attempt++)
    {
        answer = await askGemini(prompt);
        dropped = [];
        const ranked = [...(answer.schedules ?? [])].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
        for (const schedule of ranked)
        {
            const { errors, chosen } = validateSchedule(schedule, eligible, all, courses);
            if (errors.length)
            {
                dropped.push(`timetable #${schedule.rank}: ${errors.join("; ")}`);
                continue;
            }
            return JSON.stringify({
                overallScore: schedule.overallScore,
                scores: schedule.scores,
                explanation: schedule.explanation,
                tradeoffs: schedule.tradeoffs ?? [],
                warnings: [...notOffered.map(code => `${code} has no sections this term, so it was left out`), ...(answer.warnings ?? [])],
                sections: chosen,
            }, null, 2);
        }
        if (!ranked.length) break;
        prompt = `${basePrompt}
        Your previous answer broke the rules. Fix these problems:
        ${dropped.map(d => `- ${d}`).join("\n        ")}`;
    }
    const reasons = [...(answer.warnings ?? []), ...dropped];
    throw new Error(`No valid timetable${reasons.length ? `: ${reasons.join(" | ")}` : ""}`);
}