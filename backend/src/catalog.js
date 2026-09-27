// Course data, cached. Everything that touches uoCampus goes through here so the
// scraper is only ever hit once per course per term.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSections, getSubjectSections, getTerms } from "../scrapper/courseData.js";
import { cached } from "./lib/cache.js";
import { toCourses, toSections } from "./normalize.js";
import { sampleScraped, sampleTerms } from "./sample.js";
import { learnDates, withDates, withNoClassDates } from "./terms.js";

const TERM_TTL = 12 * 60 * 60 * 1000;
const COURSE_TTL = 60 * 60 * 1000;
const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");

// uoCampus slows down and answers with blank pages when hit hard, so section
// lookups for one request run a few at a time rather than all at once.
const PARALLEL_LOOKUPS = 4;

export const useSample = () => process.env.USE_SAMPLE_DATA === "true";

let scraperWorking = true;
export const scraperIsUp = () => scraperWorking;

export async function terms()
{
    if (useSample()) return sampleTerms().map(withNoClassDates);
    try
    {
        const list = await cached("terms", TERM_TTL, getTerms);
        scraperWorking = true;
        return list.map(withDates).map(withNoClassDates);
    }
    catch
    {
        scraperWorking = false;
        return sampleTerms().map(withNoClassDates);
    }
}

// uoCampus searches one subject at a time, so "ITI1120" and "iti" both become "ITI".
export function subjectOf(query)
{
    const match = String(query || "").toUpperCase().match(/[A-Z]{3,4}/);
    return match ? match[0] : null;
}

// "ITI 1120" / "iti1120" -> "ITI1120", the code format the frontend uses
const compactCode = code => String(code || "").replace(/\s+/g, "").toUpperCase();

// Every course offered in a term, from data/courses-<term>.json. uoCampus has no
// "list every course" page, and a whole-subject search stops at 300 sections, which
// big subjects like MAT and PHY exceed. So the list is built ahead of time
// (see docs/scraper.md) and search never has to scrape.
const courseLists = new Map();

function courseList(termId)
{
    if (!courseLists.has(termId))
    {
        try
        {
            const list = JSON.parse(readFileSync(path.join(DATA_DIR, `courses-${termId}.json`), "utf8"));
            courseLists.set(termId, list.map(c => ({ code: compactCode(c.course), title: c.title || compactCode(c.course), credits: 3 })));
        }
        catch
        {
            // No list for this term yet. Search falls back to scraping one subject.
            courseLists.set(termId, null);
        }
    }
    return courseLists.get(termId);
}

// Only used for terms without a course list. Big subjects come back empty here
// because of the 300-section cap, which is why the lists exist.
async function scrapedSubject(termId, subject)
{
    if (useSample()) return sampleScraped(termId, null, subject);

    try
    {
        const raw = await cached(`sections-${termId}-${subject}`, COURSE_TTL, () => getSubjectSections(termId, subject));
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

// Case and accent insensitive, so "calcul" finds "Calcul différentiel".
const fold = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export async function searchCourses(termId, query)
{
    const raw = String(query || "").trim();
    if (!raw) return [];

    const q = compactCode(raw);
    // A bare subject code ("ITI") should list that subject, not every course whose
    // title happens to contain those letters.
    const codeOnly = /^[A-Za-z]{3,4}\s*\d*$/.test(raw);

    let courses = useSample() ? null : courseList(termId);
    if (!courses)
    {
        const subject = subjectOf(raw);
        if (!subject) return [];
        courses = toCourses(await scrapedSubject(termId, subject));
    }

    const text = fold(raw);
    return courses
        .filter(c => c.code.includes(q) || (!codeOnly && fold(c.title).includes(text)))
        // Codes that start with what was typed come first, then the rest in order.
        .sort((a, b) => Number(!a.code.startsWith(q)) - Number(!b.code.startsWith(q)) || a.code.localeCompare(b.code))
        .slice(0, 40);
}

// Sections of one course, straight from an exact course search. Searching per course
// instead of per subject keeps every search well under the 300-section cap.
async function scrapedCourse(termId, code)
{
    if (useSample()) return sampleScraped(termId, [code]);

    const m = code.match(/^([A-Z]{3,4})(\d{4,5}[A-Z]?)$/);
    if (!m) return [];

    try
    {
        const raw = await cached(`course-${termId}-${code}`, COURSE_TTL, () => getSections(termId, m[1], m[2]));
        scraperWorking = true;
        learnDates(termId, raw);
        return raw;
    }
    catch
    {
        scraperWorking = false;
        return sampleScraped(termId, [code]);
    }
}

// Each course's sections in the scraper's own format, keyed by course code ("ITI1120").
// A course with nothing this term maps to []. The AI route sends these to Gemini as they are.
export async function scrapedSections(termId, courseCodes)
{
    const codes = [...new Set(courseCodes.map(compactCode))];

    const batches = new Array(codes.length);
    let next = 0;
    async function worker()
    {
        while (next < codes.length)
        {
            const i = next++;
            batches[i] = await scrapedCourse(termId, codes[i]);
        }
    }
    await Promise.all(Array.from({ length: Math.min(PARALLEL_LOOKUPS, codes.length) }, worker));

    // Keep one entry per course and section code. Duplicates would look like a class
    // clashing with itself.
    const byCourse = Object.fromEntries(codes.map(code => [code, []]));
    const seen = new Set();
    for (const entry of batches.flat())
    {
        const code = compactCode(entry.course);
        const key = `${code}|${entry.section}`;
        if (!byCourse[code] || seen.has(key)) continue;
        seen.add(key);
        byCourse[code].push(entry);
    }
    return byCourse;
}

export async function sectionsFor(termId, courseCodes)
{
    return toSections(Object.values(await scrapedSections(termId, courseCodes)).flat());
}
