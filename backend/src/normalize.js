// Turns the scraper's raw section objects into the shape the frontend expects.
// See client/src/types.ts. Any change here must be mirrored there.

import { prerequisitesFor } from "./prerequisites.js";

const DAY_CODES = { Mo: "MON", Tu: "TUE", We: "WED", Th: "THU", Fr: "FRI", Sa: "SAT", Su: "SUN" };

// "MoWeFr" -> ["MON", "WED", "FRI"]
export function parseDays(raw)
{
    const days = [];
    for (const code of String(raw || "").match(/Mo|Tu|We|Th|Fr|Sa|Su/g) || [])
    {
        const day = DAY_CODES[code];
        if (day && !days.includes(day)) days.push(day);
    }
    return days;
}

// uoCampus shows status as an image alt: "Open", "Closed", "Wait List"
export function parseStatus(raw)
{
    const text = String(raw || "").toLowerCase();
    if (text.includes("wait")) return "WAITLIST";
    if (text.includes("closed") || text.includes("full")) return "CLOSED";
    return "OPEN";
}

// Section codes look like A00 (lecture), A01 (DGD), B00... The letters are the group,
// and every component you take must come from the same group.
export function parseGroup(sectionCode)
{
    const match = String(sectionCode || "").match(/^[A-Za-z]+/);
    return match ? match[0].toUpperCase() : "A";
}

// uoCampus also uses TLB (theory and lab), PRA (practicum), REC (research), MTR (master's),
// TST (certification test) and ADM (administrative). The frontend knows five types, so map
// each to the closest one rather than LEC: two LEC types in one group would make the
// generator pick one of them instead of both.
const COMPONENTS = {
    LEC: "LEC", DGD: "DGD", LAB: "LAB", TUT: "TUT", SEM: "SEM",
    TLB: "LAB", PRA: "LAB", REC: "SEM", MTR: "SEM", TST: "TUT", ADM: "TUT",
    TBL: "LEC", THE: "LEC", WRK: "LAB",
};

export function parseComponent(raw)
{
    const key = String(raw || "").trim().toUpperCase();
    return COMPONENTS[key] || (key ? "LEC" : "LEC");
}

// "Staff", "", "To be announced" all mean nobody is listed yet.
export function parseInstructor(raw)
{
    const name = String(raw || "").replace(/\s+/g, " ").trim();
    if (!name || /^(staff|tba|to be announced|not available)$/i.test(name)) return null;
    // Some rows list several instructors separated by commas. Keep the first.
    return name.split(/\s*,\s*(?=[A-Z])/)[0].trim() || null;
}

// One scraped section can meet at several times (a lecture plus a extra hour).
// The frontend models one meeting pattern per Section, so a multi-meeting
// section becomes several Sections that share a group and component.
export function toSections(scraped)
{
    const out = [];

    for (const entry of scraped)
    {
        const courseCode = String(entry.course || "").replace(/\s+/g, "").toUpperCase();
        const group = parseGroup(entry.section);
        const component = parseComponent(entry.component);
        const status = parseStatus(entry.status);
        const timed = (entry.meetings || []).filter(m => m.start && m.end && parseDays(m.days).length);

        // Some sections list the same time once per date: a lab that runs on five
        // separate Thursdays comes back as five identical Thursday meetings. Keep one
        // per pattern, or the generator sees a section clashing with itself and drops it.
        const patterns = new Map();
        for (const m of timed)
        {
            const key = `${parseDays(m.days).join(",")}|${m.start}|${m.end}`;
            const prof = parseInstructor(m.instructor);
            const seen = patterns.get(key);
            if (!seen) patterns.set(key, { meeting: m, prof });
            else if (!seen.prof && prof) seen.prof = prof;
        }

        [...patterns.values()].forEach(({ meeting, prof }, i) =>
        {
            out.push({
                id: `${courseCode}-${entry.section}-${component}-${i}`,
                courseCode,
                sectionCode: entry.section,
                group,
                type: component,
                days: parseDays(meeting.days),
                start: meeting.start,
                end: meeting.end,
                prof,
                location: meeting.room || null,
                status,
            });
        });
    }

    return out;
}

// The catalog entry the course search returns.
export function toCourses(scraped)
{
    const seen = new Map();
    for (const entry of scraped)
    {
        const code = String(entry.course || "").replace(/\s+/g, "").toUpperCase();
        if (!code || seen.has(code)) continue;
        seen.set(code, { code, title: entry.title || code, credits: 3, prerequisites: prerequisitesFor(code) });
    }
    return [...seen.values()];
}
