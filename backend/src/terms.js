// uoCampus gives terms as a code and a label ("2269", "2026 Fall Term").
// The frontend also needs start and end dates for calendar export, and the search
// page does not show them. We guess from the season, then correct ourselves with the
// real dates the moment any section for that term is scraped.

import { peek, put } from "./lib/cache.js";

const KEY = "term-dates";

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

export function withDates(term)
{
    const known = (peek(KEY) || {})[term.id];
    const dates = known || guess(term.label || term.name || "");
    return { id: String(term.id), name: term.label || term.name || String(term.id), ...dates };
}

// ---------- Days with no classes ----------
//
// uoCampus doesn't publish these, so they come from rules. The holidays are fixed by
// Ontario law. The reading weeks are a guess at uOttawa's pattern (the week of
// Thanksgiving in fall, the week of Family Day in winter) and should be checked
// against the uOttawa important-dates page each year.

const iso = d => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
const addDays = (d, n) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));

// The nth Monday of a month (month is 0-based).
function nthMonday(year, month, n)
{
    const first = new Date(Date.UTC(year, month, 1));
    return addDays(first, ((8 - first.getUTCDay()) % 7) + (n - 1) * 7);
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
        ...weekOf(nthMonday(year, 9, 2)), // Thanksgiving and fall reading week
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

// Scraped meetings carry real start and end dates. Widest range wins.
export function learnDates(termId, scraped)
{
    const starts = [];
    const ends = [];
    for (const entry of scraped)
    {
        for (const m of entry.meetings || [])
        {
            if (m.startDate) starts.push(m.startDate);
            if (m.endDate) ends.push(m.endDate);
        }
    }
    if (!starts.length || !ends.length) return;

    const all = peek(KEY) || {};
    all[String(termId)] = { startDate: starts.sort()[0], endDate: ends.sort().at(-1), guessed: false };
    put(KEY, all);
}
