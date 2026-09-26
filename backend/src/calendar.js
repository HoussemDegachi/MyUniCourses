// Pushing a schedule into the student's Google Calendar.
//
// How the pieces fit:
//   1. The student signs in through Auth0 using the Google connection, which asks
//      for calendar permission at the same time.
//   2. Auth0 stores the Google access token. We fetch it with the Management API,
//      which needs a machine-to-machine app with read:user_idp_tokens.
//   3. We create a calendar named after the term and add one recurring event per class.
//
// The Google token never goes to the browser, and we only ever write to a calendar
// we created ourselves, so nothing in their existing calendar can be overwritten.

const MANAGEMENT_SCOPE = "read:user_idp_tokens";
const GOOGLE_API = "https://www.googleapis.com/calendar/v3";
const TZ = "America/Toronto";

const RFC_DAY = { MON: "MO", TUE: "TU", WED: "WE", THU: "TH", FRI: "FR", SAT: "SA" };
const JS_INDEX = { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

export const calendarEnabled = () => Boolean(
    process.env.AUTH0_DOMAIN && process.env.AUTH0_M2M_CLIENT_ID && process.env.AUTH0_M2M_CLIENT_SECRET,
);

let managementToken = { value: null, expiresAt: 0 };

async function getManagementToken()
{
    if (managementToken.value && Date.now() < managementToken.expiresAt - 60000) return managementToken.value;

    const res = await fetch(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            grant_type: "client_credentials",
            client_id: process.env.AUTH0_M2M_CLIENT_ID,
            client_secret: process.env.AUTH0_M2M_CLIENT_SECRET,
            audience: `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
            scope: MANAGEMENT_SCOPE,
        }),
    });

    if (!res.ok) throw new Error(`Auth0 management token failed: ${res.status}`);
    const data = await res.json();
    managementToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return managementToken.value;
}

// Auth0 keeps the Google token on the user's identity record.
async function getGoogleToken(userId)
{
    const token = await getManagementToken();
    const res = await fetch(`https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Auth0 user lookup failed: ${res.status}`);

    const user = await res.json();
    const google = (user.identities || []).find(i => i.provider === "google-oauth2");
    if (!google?.access_token)
    {
        const error = new Error("This account isn't connected to Google Calendar.");
        error.code = "NO_GOOGLE";
        throw error;
    }
    return google.access_token;
}

async function google(token, path, options = {})
{
    const res = await fetch(`${GOOGLE_API}${path}`, {
        ...options,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers },
    });
    if (!res.ok)
    {
        const body = await res.text();
        const error = new Error(`Google Calendar ${res.status}: ${body.slice(0, 200)}`);
        error.status = res.status;
        if (res.status === 401 || res.status === 403) error.code = "GOOGLE_PERMISSION";
        throw error;
    }
    return res.status === 204 ? null : res.json();
}

// The first date on or after the term start that lands on one of the class's days.
function firstMeeting(termStart, days)
{
    const [y, m, d] = termStart.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    const wanted = new Set(days.map(day => JS_INDEX[day]));
    for (let i = 0; i < 7 && !wanted.has(date.getUTCDay()); i++) date.setUTCDate(date.getUTCDate() + 1);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export async function pushSchedule({ userId, schedule, term, calendarName })
{
    const token = await getGoogleToken(userId);

    // Its own calendar, so the student can hide or delete the whole thing in one click.
    const calendar = await google(token, "/calendars", {
        method: "POST",
        body: JSON.stringify({ summary: `${calendarName}: ${term.name}`, timeZone: TZ }),
    });

    const until = term.endDate.replace(/-/g, "") + "T235959Z";
    let created = 0;
    const failed = [];

    for (const s of schedule.sections)
    {
        const date = firstMeeting(term.startDate, s.days);
        try
        {
            await google(token, `/calendars/${encodeURIComponent(calendar.id)}/events`, {
                method: "POST",
                body: JSON.stringify({
                    summary: `${s.courseCode} ${s.type}`,
                    location: s.location || undefined,
                    description: [s.prof ? `Prof: ${s.prof}` : null, `Section ${s.sectionCode}`, s.status === "WAITLIST" ? "Waitlisted" : null]
                        .filter(Boolean).join("\n"),
                    start: { dateTime: `${date}T${s.start}:00`, timeZone: TZ },
                    end: { dateTime: `${date}T${s.end}:00`, timeZone: TZ },
                    recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${s.days.map(d => RFC_DAY[d]).join(",")};UNTIL=${until}`],
                    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 20 }] },
                }),
            });
            created++;
        }
        catch
        {
            failed.push(`${s.courseCode} ${s.type}`);
        }
    }

    return { calendarId: calendar.id, calendarName: calendar.summary, created, failed };
}
