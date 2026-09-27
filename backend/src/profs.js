// Professor info for the whole backend. Scoring, the hover card and the AI route all
// read ratings through here, so a name always gets the same rating from the same lookup.

import { useSample } from "./catalog.js";
import { geminiEnabled, summarizeProf } from "./gemini.js";
import { cached } from "./lib/cache.js";
import { lookupProf } from "./rmp.js";
import { sampleProf } from "./sample.js";

const SUMMARY_TTL = 7 * 24 * 60 * 60 * 1000;

// The rating on its own, with no AI summary. Scoring only needs this.
export async function profRating(name)
{
    if (useSample()) return sampleProf(name);
    const prof = await lookupProf(name);
    if (!prof) return null;
    const { reviews, ...rest } = prof;
    return { ...rest, summary: null };
}

// Rating plus the AI summary of the reviews, for the hover card.
export async function profSummary(name)
{
    if (useSample()) return sampleProf(name);

    const prof = await lookupProf(name);
    if (!prof) return null;
    const { reviews, ...rest } = prof;

    let summary = null;
    if (geminiEnabled() && reviews.length)
    {
        try
        {
            // cached() only stores a result that came back, so a failed call (the free
            // tier runs out fast) is tried again next time instead of sticking for a week.
            summary = await cached(`prof-ai-summary-${name.toLowerCase()}`, SUMMARY_TTL, () => summarizeProf(prof.rmpName || name, reviews));
        }
        catch (err)
        {
            console.error("prof summary failed", err.message);
        }
    }
    return { ...rest, summary };
}

// Ratings for every prof named, keyed by name. Profs with no match are left out. No Gemini
// here: building schedules for five courses can involve twenty profs, and summarizing each
// one would burn through the free quota before the student even hovers one.
export async function profMap(names)
{
    const unique = [...new Set(names.filter(Boolean))];
    const entries = [];
    // A few at a time: Rate My Professors is an undocumented endpoint, so be gentle.
    for (let i = 0; i < unique.length; i += 4)
    {
        entries.push(...await Promise.all(unique.slice(i, i + 4).map(async name =>
        {
            try
            {
                return [name, await profRating(name)];
            }
            catch
            {
                return [name, null];
            }
        })));
    }
    return Object.fromEntries(entries.filter(([, p]) => p));
}
