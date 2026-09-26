// Course data, cached. Everything that touches uoCampus goes through here so the
// scraper is only ever hit once per subject per term.

import { getSubjectSections, getTerms } from "../scrapper/courseData.js";
import { cached } from "./lib/cache.js";
import { toCourses, toSections } from "./normalize.js";
import { sampleScraped, sampleTerms } from "./sample.js";
import { learnDates, withDates } from "./terms.js";

const TERM_TTL = 12 * 60 * 60 * 1000;
const SUBJECT_TTL = 60 * 60 * 1000;

export const useSample = () => process.env.USE_SAMPLE_DATA === "true";

let scraperWorking = true;
export const scraperIsUp = () => scraperWorking;

export async function terms()
{
    if (useSample()) return sampleTerms();
    try
    {
        const list = await cached("terms", TERM_TTL, getTerms);
        scraperWorking = true;
        return list.map(withDates);
    }
    catch
    {
        scraperWorking = false;
        return sampleTerms();
    }
}

// uoCampus searches one subject at a time, so "ITI1120" and "iti" both become "ITI".
export function subjectOf(query)
{
    const match = String(query || "").toUpperCase().match(/[A-Z]{3,4}/);
    return match ? match[0] : null;
}

async function scrapedSubject(termId, subject)
{
    if (useSample()) return sampleScraped(termId, null, subject);

    try
    {
        const raw = await cached(`sections-${termId}-${subject}`, SUBJECT_TTL, () => getSubjectSections(termId, subject));
        scraperWorking = true;
        learnDates(termId, raw);
        return raw;
    }
    catch
    {
        scraperWorking = false;
        return sampleScraped(termId);
    }
}

export async function searchCourses(termId, query)
{
    const subject = subjectOf(query);
    if (!subject) return [];

    const courses = toCourses(await scrapedSubject(termId, subject));
    const raw = String(query).trim();
    const q = raw.toUpperCase().replace(/\s+/g, "");
    // A bare subject code ("ITI") should list that subject, not every course whose
    // title happens to contain those letters.
    const codeOnly = /^[A-Za-z]{3,4}\s*\d*$/.test(raw);

    return courses
        .filter(c => c.code.includes(q) || (!codeOnly && c.title.toUpperCase().includes(raw.toUpperCase())))
        .sort((a, b) => a.code.localeCompare(b.code))
        .slice(0, 40);
}

export async function sectionsFor(termId, courseCodes)
{
    const subjects = [...new Set(courseCodes.map(subjectOf).filter(Boolean))];
    const batches = await Promise.all(subjects.map(s => scrapedSubject(termId, s)));

    // Two subjects can return the same course, so keep one entry per course and
    // section code. Duplicates would look like a class clashing with itself.
    const seen = new Set();
    const raw = [];
    for (const entry of batches.flat())
    {
        const code = String(entry.course || "").replace(/\s+/g, "").toUpperCase();
        const key = `${code}|${entry.section}`;
        if (!courseCodes.includes(code) || seen.has(key)) continue;
        seen.add(key);
        raw.push(entry);
    }

    return toSections(raw);
}
