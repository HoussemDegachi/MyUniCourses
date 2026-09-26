// Turns the scraper's raw section objects into the shape the frontend expects.
// See planner/src/types.ts. Any change here must be mirrored there.

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

const COMPONENTS = { LEC: "LEC", DGD: "DGD", LAB: "LAB", TUT: "TUT", SEM: "SEM", TBL: "LEC", THE: "LEC", WRK: "LAB" };

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
        const meetings = (entry.meetings || []).filter(m => m.start && m.end && parseDays(m.days).length);

        meetings.forEach((meeting, i) =>
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
                prof: parseInstructor(meeting.instructor),
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
        seen.set(code, { code, title: entry.title || code, credits: 3 });
    }
    return [...seen.values()];
}
