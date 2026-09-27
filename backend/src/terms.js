// uoCampus gives terms as a code and a label ("2269", "2026 Fall Term").
// The frontend also needs start and end dates for calendar export, and the search
// page does not show them. We use dates confirmed from a real scrape where we have
// them, otherwise guess from the season, and correct ourselves from the meetings of
// every course scraped for that term.

import { peek, put } from "./lib/cache.js";

const KEY = "term-dates";

// First and last day of classes, read off the scraped meetings of these terms.
const KNOWN = {
    "2269": { startDate: "2026-09-09", endDate: "2026-12-09" },
    "2271": { startDate: "2027-01-11", endDate: "2027-04-14" },
};

// Rough uOttawa term windows. Replace a guess as soon as real data arrives.
const SEASONS = [
    { match: /fall|automne/i, start: "09-04", end: "12-15" },
    { match: /winter|hiver/i, start: "01-08", end: "04-15" },
    { match: /spring|summer|printemps|été|ete/i, start: "05-05", end: "08-15" },
];

function guess(label)
{
    const year = Number((label.match(/(20\d{2})/) || [])[1]) || new Date().getFullYear();
    const season = SEASONS.find(s => s.match.test(label)) || SEASONS[0];
    return { startDate: `${year}-${season.start}`, endDate: `${year}-${season.end}`, guessed: true };
}

const mostCommon = counts => [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];

export function withDates(term)
{
    const id = String(term.id);
    const tally = (peek(KEY) || {})[id];
    const learned = tally && { startDate: mostCommon(Object.entries(tally.starts)), endDate: mostCommon(Object.entries(tally.ends)), guessed: false };
    const dates = learned || (KNOWN[id] && { ...KNOWN[id], guessed: false }) || guess(term.label || term.name || "");
    return { id, name: term.label || term.name || id, ...dates };
}

// ---------- Days with no classes ----------
//
// uoCampus doesn't publish these, so they come from rules. The holidays are fixed by
// Ontario law. The reading weeks follow uOttawa's pattern: fall is the week of the last
// Monday in October (Oct 25 to 31 in 2026), winter is the week of Family Day (Feb 15 to 21
// in 2027). Check them against the uOttawa important-dates page each year.

const iso = d => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
const addDays = (d, n) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));

// The nth Monday of a month (month is 0-based).
function nthMonday(year, month, n)
{
    const first = new Date(Date.UTC(year, month, 1));
    return addDays(first, ((8 - first.getUTCDay()) % 7) + (n - 1) * 7);
}

// The last Monday of a month (month is 0-based).
function lastMonday(year, month)
{
    const last = new Date(Date.UTC(year, month + 1, 0));
    return addDays(last, -((last.getUTCDay() + 6) % 7));
}

// Anonymous Gregorian computus.
function easter(year)
{
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(year, month - 1, day));
}

// Monday to Saturday of the week starting on the given Monday.
const weekOf = monday => Array.from({ length: 6 }, (_, i) => addDays(monday, i));

function candidates(year)
{
    const may24 = new Date(Date.UTC(year, 4, 24));
    const victoria = addDays(may24, -((may24.getUTCDay() + 6) % 7));
    return [
        nthMonday(year, 9, 2), // Thanksgiving
        ...weekOf(lastMonday(year, 9)), // fall reading week
        ...weekOf(nthMonday(year, 1, 3)), // Family Day and winter reading week
        addDays(easter(year), -2), // Good Friday
        victoria, // Victoria Day, the Monday before May 25
        new Date(Date.UTC(year, 6, 1)), // Canada Day
        nthMonday(year, 7, 1), // Civic Holiday
        nthMonday(year, 8, 1), // Labour Day
    ];
}

export function noClassDates(startDate, endDate)
{
    const years = new Set([startDate.slice(0, 4), endDate.slice(0, 4)].map(Number));
    return [...years]
        .flatMap(candidates)
        .map(iso)
        .filter(d => d >= startDate && d <= endDate)
        .sort();
}

export const withNoClassDates = term => ({ ...term, noClassDates: noClassDates(term.startDate, term.endDate) });

// Scraped meetings carry real start and end dates. The most common ones are the
// term's; the widest range would let one intensive or full-year section stretch it.
export function learnDates(termId, scraped)
{
    const all = peek(KEY) || {};
    const tally = all[String(termId)] || { starts: {}, ends: {} };
    let seen = false;
    for (const entry of scraped)
    {
        for (const m of entry.meetings || [])
        {
            if (!m.startDate || !m.endDate || m.startDate === m.endDate) continue; // one-off dates, like a single lab session
            tally.starts[m.startDate] = (tally.starts[m.startDate] || 0) + 1;
            tally.ends[m.endDate] = (tally.ends[m.endDate] || 0) + 1;
            seen = true;
        }
    }
    if (!seen) return;
    all[String(termId)] = tally;
    put(KEY, all);
}
