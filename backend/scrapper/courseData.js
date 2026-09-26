import * as cheerio from "cheerio";
import { pathToFileURL } from "node:url";

const URL = "https://uocampus.public.uottawa.ca/psc/csprpr9pub/EMPLOYEE/SA/c/UO_SR_AA_MODS.UO_PUB_CLSSRCH.GBL";

// PeopleSoft keeps the search state in cookies, and Node's fetch has no cookie jar,
// so each search gets its own small session that follows redirects by hand.
class Session
{
    constructor()
    {
        this.cookies = new Map();
    }

    async request(url, options = {})
    {
        for (let hop = 0; hop < 10; hop++)
        {
            const res = await fetch(url, {
                ...options,
                redirect: "manual",
                headers: { "User-Agent": "Mozilla/5.0", Cookie: this.cookieHeader(), ...options.headers },
            });
            for (const line of res.headers.getSetCookie())
            {
                const [pair] = line.split(";");
                const eq = pair.indexOf("=");
                this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
            }
            const location = res.headers.get("location");
            if (res.status >= 300 && res.status < 400 && location)
            {
                url = new globalThis.URL(location, url).href;
                options = { method: "GET" };
                continue;
            }
            return await res.text();
        }
        throw new Error("too many redirects");
    }

    cookieHeader()
    {
        return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    }
}

function readForm($)
{
    const fields = {};
    $("input[name]").each((_, el) =>
    {
        const input = $(el);
        if ((input.attr("type") || "").toLowerCase() === "checkbox")
        {
            if (input.attr("checked") !== undefined) fields[input.attr("name")] = input.attr("value") ?? "Y";
            return;
        }
        fields[input.attr("name")] = input.attr("value") ?? "";
    });
    $("select[name]").each((_, el) =>
    {
        const select = $(el);
        fields[select.attr("name")] = select.find("option[selected]").attr("value") ?? "";
    });
    return fields;
}

async function openSearchPage(session)
{
    // The first hit can be a cookie check page; retry until the real form appears
    for (let attempt = 0; attempt < 5; attempt++)
    {
        const html = await session.request(URL);
        const $ = cheerio.load(html);
        if ($("#ICSID").length) return $;
    }
    throw new Error("could not load the uoCampus class search form");
}

// Cells with several meetings put one per line with <br>
function lines($, el)
{
    if (!el.length) return [];
    return el.html().split(/<br\s*\/?>/i)
        .map(part => cheerio.load(part).text().replace(/\s+/g, " ").trim())
        .filter(Boolean);
}

function parseResults($)
{
    const message = $("span.PSERRORTEXT, span.SSSMSGALERTTEXT").first().text().replace(/\s+/g, " ").trim();
    const courses = [];

    $("div[id^='win0divSSR_CLSRSLT_WRK_GROUPBOX2GP$']").each((_, header) =>
    {
        const k = $(header).attr("id").split("$")[1];
        const title = $(header).text().replace(/\s+/g, " ").trim();
        const body = $(`div[id='win0divSSR_CLSRSLT_WRK_GROUPBOX2$${k}']`);
        const sections = [];

        body.find("a[id^='MTG_CLASS_NBR$']").each((_, link) =>
        {
            const i = $(link).attr("id").split("$")[1];
            const [section = "", session = ""] = lines($, $(`[id='MTG_CLASSNAME$${i}']`));
            const [code, component] = section.split("-");
            sections.push({
                section: code,
                component,
                session,
                status: $(`div[id='win0divDERIVED_CLSRCH_SSR_STATUS_LONG$${i}'] img`).attr("alt") || "",
                times: lines($, $(`[id='MTG_DAYTIME$${i}']`)),
                instructors: lines($, $(`[id='MTG_INSTR$${i}']`)),
                dates: lines($, $(`[id='MTG_TOPIC$${i}']`)),
                rooms: lines($, $(`[id='MTG_ROOM$${i}']`)),
            });
        });

        courses.push({ title, sections });
    });

    return { message: courses.length ? "" : message, courses };
}

export async function getTerms()
{
    const $ = await openSearchPage(new Session());
    return $("select[id='CLASS_SRCH_WRK2_STRM$35$'] option")
        .map((_, o) => ({ id: $(o).attr("value"), label: $(o).text().trim() }))
        .get()
        .filter(t => t.id);
}

async function searchCourse(term, subject, number)
{
    // An empty number means "every course in this subject", which needs the
    // "contains" match type instead of "exact".
    const hasNumber = String(number ?? "").trim().length > 0;
    const session = new Session();
    const $ = await openSearchPage(session);
    const fields = readForm($);
    Object.assign(fields, {
        "ICAction": "CLASS_SRCH_WRK2_SSR_PB_CLASS_SRCH",
        "CLASS_SRCH_WRK2_STRM$35$": term,
        "SSR_CLSRCH_WRK_SUBJECT$0": subject.toUpperCase(),
        "SSR_CLSRCH_WRK_SSR_EXACT_MATCH1$0": hasNumber ? "E" : "C",
        "SSR_CLSRCH_WRK_CATALOG_NBR$0": hasNumber ? String(number).trim() : "",
        "SSR_CLSRCH_WRK_SSR_OPEN_ONLY$chk$0": "N",
    });
    delete fields["SSR_CLSRCH_WRK_SSR_OPEN_ONLY$0"];

    const html = await session.request(URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(fields).toString(),
    });
    return parseResults(cheerio.load(html));
}

// "Tu 17:30 - 18:50" + "Staff" + "2027-01-11 - 2027-04-14" -> one meeting object
function toMeeting(time, instructor, dates, room)
{
    const t = time.match(/^(\S+)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
    const d = (dates || "").match(/^(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})$/);
    return {
        days: t ? t[1] : time,
        start: t ? t[2] : null,
        end: t ? t[3] : null,
        instructor: instructor || null,
        startDate: d ? d[1] : null,
        endDate: d ? d[2] : null,
        room: room && !/^tba$/i.test(room) ? room : null,
    };
}

// Flattens a searchCourse result into one entry per section
function toSectionList(result, term)
{
    const sections = [];
    for (const course of result.courses)
    {
        const [code, ...rest] = course.title.split(" - ");
        for (const s of course.sections)
        {
            sections.push({
                term,
                course: code.trim(),
                title: rest.join(" - ").trim(),
                section: s.section,
                component: s.component,
                status: s.status,
                open: s.status.toLowerCase() === "open",
                meetings: s.times.map((time, i) => toMeeting(time, s.instructors[i], s.dates[i], s.rooms?.[i])),
            });
        }
    }
    return sections;
}

// Flat list of sections, one entry per section. Throws if uoCampus is unreachable.
export async function getSections(term, subject, number)
{
    return toSectionList(await searchCourse(term, subject, number), term);
}

// Every course in a subject for a term, used to power course search.
export async function getSubjectSections(term, subject)
{
    return toSectionList(await searchCourse(term, subject, ""), term);
}

// Flat list of sections as a JSON string, one entry per section
export async function getCourseJSON(term, subject, number, pretty = true)
{
    const sections = toSectionList(await searchCourse(term, subject, number), term);
    return JSON.stringify(sections, null, pretty ? 2 : 0);
}
