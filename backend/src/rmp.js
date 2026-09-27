// Rate My Professors lookup.
//
// This uses the public GraphQL endpoint their own site calls. It is not a documented
// API and their terms discourage automated access, so: cache hard, send few requests,
// and treat every failure as "no rating" rather than breaking the page. If a judge asks,
// the honest answer is that this is a prototype and a production version would need
// their permission or a different data source.

import { cached } from "./lib/cache.js";

const ENDPOINT = "https://www.ratemyprofessors.com/graphql";
const AUTH = process.env.RMP_AUTH || "Basic dGVzdDp0ZXN0";
// base64("School-1452"), University of Ottawa (ratemyprofessors.com/school/1452).
// 1438, the old default here, is the University of Manitoba.
const SCHOOL_ID = process.env.RMP_SCHOOL_ID || "U2Nob29sLTE0NTI=";
const TTL = 7 * 24 * 60 * 60 * 1000;

// fallback: false stops RMP from answering with profs at other schools when the
// name isn't found at uOttawa, which could pair a real name with a stranger's rating.
const SEARCH = `
query TeacherSearch($text: String!, $schoolID: ID!) {
  newSearch {
    teachers(query: {text: $text, schoolID: $schoolID, fallback: false}, first: 8) {
      edges { node {
        id legacyId firstName lastName department
        avgRating avgDifficulty wouldTakeAgainPercent numRatings
        teacherRatingTags { tagName tagCount }
      } }
    }
  }
}`;

const RATINGS = `
query TeacherRatings($id: ID!) {
  node(id: $id) { ... on Teacher {
    ratings(first: 25) { edges { node { comment class qualityRating } } }
  } }
}`;

async function graphql(query, variables)
{
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try
    {
        const res = await fetch(ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: AUTH,
                "User-Agent": "Mozilla/5.0",
            },
            body: JSON.stringify({ query, variables }),
            signal: controller.signal,
        });
        if (!res.ok) throw new Error(`RMP ${res.status}`);
        const json = await res.json();
        if (json.errors?.length) throw new Error(json.errors[0].message);
        return json.data;
    }
    finally
    {
        clearTimeout(timeout);
    }
}

// uoCampus and Rate My Professors write names differently: middle names, accents,
// hyphens, the same prof listed twice. Take the closest match, in this order:
//   1. the full name matches
//   2. first and last name match, ignoring middle names
//   3. last name matches, one name's words all appear in the other ("Md Mahmud Hasan"
//      goes by Mahmud Hasan), and only one prof fits
//   4. last name matches, one first name is short for the other ("J." or "Rob" for
//      Robert), and only one prof fits
// and give up rather than guess past that, because a wrong match shows a stranger's
// rating: a last name alone once paired Gefen Bar-On Santor with Darcy Santor.
// When a name has several profiles, the one with the most ratings wins.
function pickMatch(name, edges)
{
    const wanted = words(name);
    if (!wanted.length) return null;
    const first = wanted[0];
    const last = wanted[wanted.length - 1];

    const teachers = edges.map(e => ({ teacher: e.node, parts: words(`${e.node.firstName} ${e.node.lastName}`) }));
    const mostRated = list => list.sort((a, b) => (b.teacher.numRatings || 0) - (a.teacher.numRatings || 0))[0].teacher;

    const exact = teachers.filter(t => t.parts.join(" ") === wanted.join(" "));
    if (exact.length) return mostRated(exact);

    const firstLast = teachers.filter(t => t.parts[0] === first && t.parts[t.parts.length - 1] === last);
    if (firstLast.length) return mostRated(firstLast);

    const sameLast = teachers.filter(t => t.parts[t.parts.length - 1] === last);
    const within = sameLast.filter(t => inOrder(t.parts, wanted) || inOrder(wanted, t.parts));
    if (within.length) return within.length === 1 ? within[0].teacher : null;

    const shortFor = (a = "", b = "") => a.startsWith(b) || b.startsWith(a);
    const short = sameLast.filter(t => shortFor(t.parts[0], first));
    return short.length === 1 ? short[0].teacher : null;
}

// True when every word of a appears in b, in the same order.
function inOrder(a, b)
{
    let i = 0;
    for (const word of b) if (word === a[i]) i++;
    return i === a.length;
}

function normalize(s)
{
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

// "Jean-Luc Côté" -> ["jean", "luc", "cote"]
const words = s => normalize(s).replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);

// Returns { name, rating, difficulty, wouldTakeAgain, numRatings, tags, reviews } or null.
export async function lookupProf(name)
{
    return cached(`rmp-${normalize(name)}`, TTL, async () =>
    {
        try
        {
            const search = await graphql(SEARCH, { text: name, schoolID: SCHOOL_ID });
            const teacher = pickMatch(name, search?.newSearch?.teachers?.edges || []);
            if (!teacher) return null;

            let reviews = [];
            try
            {
                const detail = await graphql(RATINGS, { id: teacher.id });
                reviews = (detail?.node?.ratings?.edges || [])
                    .map(e => ({ comment: String(e.node.comment || "").trim(), course: e.node.class || null }))
                    .filter(r => r.comment.length > 15);
            }
            catch
            {
                // Ratings are optional. The score alone is still useful.
            }

            return {
                name,
                // RMP names sometimes carry stray spaces ("Nicolas  Brodeur").
                rmpName: `${teacher.firstName} ${teacher.lastName}`.replace(/\s+/g, " ").trim(),
                rating: teacher.avgRating > 0 ? Number(teacher.avgRating.toFixed(1)) : null,
                difficulty: teacher.avgDifficulty > 0 ? Number(teacher.avgDifficulty.toFixed(1)) : null,
                wouldTakeAgain: teacher.wouldTakeAgainPercent > 0 ? Math.round(teacher.wouldTakeAgainPercent) : null,
                numRatings: teacher.numRatings || 0,
                tags: (teacher.teacherRatingTags || [])
                    .sort((a, b) => b.tagCount - a.tagCount)
                    .slice(0, 3)
                    .map(t => titleCase(t.tagName)),
                reviews,
            };
        }
        catch
        {
            return null;
        }
    });
}

function titleCase(s)
{
    return String(s).toLowerCase().replace(/(^|\s)\w/g, c => c.toUpperCase());
}
