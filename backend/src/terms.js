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
