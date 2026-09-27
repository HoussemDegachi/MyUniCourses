// Builds data/courses-<term>.json: every course with at least one section in a term.
//
//   node scripts/build-course-list.js            lists the terms uoCampus has right now
//   node scripts/build-course-list.js 2275       builds the list for that term (3 to 5 minutes)
//   node scripts/build-course-list.js 2275 --subjects=ITI,MAT   quick check, prints instead of saving
//
// Course search reads these files instead of scraping, because uoCampus has no "list every
// course" page and a whole-subject search stops at 300 sections. Run this once per new term.

import * as cheerio from "cheerio";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SEARCH_URL, Session, getTerms, openSearchPage, readForm, searchCourse } from "../scrapper/courseData.js";

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");

// More parallel searches than this only earns blank pages from uoCampus, not speed.
const PARALLEL = 8;

// uoCampus stops at 300 sections per search, so a big subject is split by year of study,
// and a year that is still too big is split by component, since every section has exactly one.
const YEARS = [1, 2, 3, 4].map(n => ({
    label: `year ${n}`,
    fields: { [`UO_PUB_SRCH_WRK_SSR_RPTCK_OPT_0${n}$chk$0`]: "Y", [`UO_PUB_SRCH_WRK_SSR_RPTCK_OPT_0${n}$0`]: "Y" },
})).concat({
    label: "graduate",
    fields: { "UO_PUB_SRCH_WRK_GRADUATED_TBL_CD$chk$0": "Y", "UO_PUB_SRCH_WRK_GRADUATED_TBL_CD$0": "Y" },
});
const COMPONENTS = ["LEC", "LAB", "DGD", "TUT", "SEM", "TLB", "PRA", "REC", "MTR", "TST", "ADM"]
    .map(code => ({ label: code, fields: { "SSR_CLSRCH_WRK_SSR_COMPONENT$0": code } }));

const tooBig = result => /maximum limit|exceed/i.test(result.message);

async function post(session, fields)
{
    const html = await session.request(SEARCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(fields).toString(),
    });
    return cheerio.load(html);
}

// Every subject code from uoCampus's "select subject" lookup, which pages by first letter.
async function getSubjects(term)
{
    const session = new Session();
    let $ = await openSearchPage(session);
    $ = await post(session, { ...readForm($), "CLASS_SRCH_WRK2_STRM$35$": String(term), ICAction: "CLASS_SRCH_WRK2_SSR_PB_SUBJ_SRCH$0" });

    const subjects = new Set();
    const collect = () => $("[id^='SSR_CLSRCH_SUBJ_SUBJECT$']").each((_, el) =>
    {
        const code = $(el).text().trim();
        if (code) subjects.add(code);
    });
    collect();

    for (const action of new Set($.html().match(/SSR_CLSRCH_WRK2_SSR_ALPHANUM_[A-Z0-9]/g) ?? []))
    {
        $ = await post(session, { ...readForm($), ICAction: action });
        collect();
    }
    if (!subjects.size) throw new Error("could not read the subject list from uoCampus");
    return [...subjects];
}

// Course headers ("MAT 1320 - Calculus I") for one subject, split up when it hits the cap.
async function subjectCourses(term, subject, warnings)
{
    const whole = await searchCourse(term, subject, "");
    if (!tooBig(whole)) return whole.courses;

    const courses = [];
    for (const year of YEARS)
    {
        const slice = await searchCourse(term, subject, "", year.fields);
        if (!tooBig(slice))
        {
            courses.push(...slice.courses);
            continue;
        }
        for (const component of COMPONENTS)
        {
            const smaller = await searchCourse(term, subject, "", { ...year.fields, ...component.fields });
            // Courses in an oversized component almost always have another one too (every
            // first-year PHY lab course also has a lecture), so they still show up.
            if (tooBig(smaller)) warnings.push(`${subject} ${year.label} ${component.label} is over 300 sections; ${component.label}-only courses there may be missing`);
            else courses.push(...smaller.courses);
        }
    }
    return courses;
}

// "MAT 1321 - Foundations of Calculus I (+1 combined)" -> { course: "MAT 1321", title }
function parseHeader(header)
{
    const m = header.match(/^([A-Z]{3,4})\s*(\S+)\s+-\s+(.*?)(?:\s*\(\+\d+ combined\))?$/);
    return m ? { course: `${m[1]} ${m[2]}`, title: m[3].trim() } : null;
}

async function buildList(term, only)
{
    const subjects = only ?? await getSubjects(term);
    const courses = new Map();
    const warnings = [];
    const failed = [];

    async function one(subject)
    {
        for (const header of await subjectCourses(term, subject, warnings))
        {
            const parsed = parseHeader(header.title);
            if (parsed && !courses.has(parsed.course)) courses.set(parsed.course, parsed);
        }
    }

    let next = 0;
    let done = 0;
    async function worker()
    {
        while (next < subjects.length)
        {
            const subject = subjects[next++];
            try
            {
                await one(subject);
            }
            catch
            {
                failed.push(subject);
            }
            process.stdout.write(`\r  ${++done}/${subjects.length} subjects (last: ${subject})   `);
        }
    }
    await Promise.all(Array.from({ length: Math.min(PARALLEL, subjects.length) }, worker));
    process.stdout.write("\n");

    // Subjects that kept getting blank pages usually work once the parallel load is gone.
    for (const subject of failed)
    {
        try
        {
            await one(subject);
        }
        catch (err)
        {
            warnings.push(`${subject} could not be searched: ${err.message}`);
        }
    }

    for (const w of warnings) console.warn(`  warning: ${w}`);
    return [...courses.values()].sort((a, b) => a.course.localeCompare(b.course));
}

const term = process.argv[2];
if (!term || !/^\d{4}$/.test(term))
{
    console.log("Terms on uoCampus right now:");
    for (const t of await getTerms()) console.log(`  ${t.id}  ${t.label}`);
    console.log("\nUsage: node scripts/build-course-list.js <term> [--subjects=ITI,MAT]");
    process.exit(term ? 1 : 0);
}

const subjectsArg = process.argv.find(a => a.startsWith("--subjects="));
const only = subjectsArg ? subjectsArg.split("=")[1].split(",").map(s => s.trim().toUpperCase()).filter(Boolean) : null;

const started = Date.now();
console.log(`Building the course list for ${term}${only ? ` (only ${only.join(", ")})` : ""}...`);
const list = await buildList(term, only);
const seconds = ((Date.now() - started) / 1000).toFixed(0);

if (only)
{
    console.log(`${list.length} courses in ${seconds} s. Not saved, because only some subjects were searched:`);
    for (const c of list) console.log(`  ${c.course}  ${c.title}`);
}
else
{
    const file = path.join(DATA_DIR, `courses-${term}.json`);
    await writeFile(file, JSON.stringify(list, null, 2));
    console.log(`${list.length} courses in ${seconds} s, saved to ${path.relative(process.cwd(), file)}. Restart the backend to use it.`);
}
