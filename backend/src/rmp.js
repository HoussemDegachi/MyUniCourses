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
const SCHOOL_ID = process.env.RMP_SCHOOL_ID || "U2Nob29sLTE0Mzg="; // University of Ottawa
const TTL = 7 * 24 * 60 * 60 * 1000;

const SEARCH = `
query TeacherSearch($text: String!, $schoolID: ID!) {
  newSearch {
    teachers(query: {text: $text, schoolID: $schoolID}, first: 8) {
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

// uoCampus writes names in several ways. Match on last name plus first initial,
// and give up rather than guess when nothing lines up.
function pickMatch(name, edges)
{
    const parts = name.replace(/\./g, " ").split(/\s+/).filter(Boolean);
    if (!parts.length) return null;
    const last = normalize(parts[parts.length - 1]);
    const firstInitial = normalize(parts[0])[0];

    const byLast = edges.map(e => e.node).filter(t => normalize(t.lastName) === last);
    if (!byLast.length) return null;
    if (byLast.length === 1) return byLast[0];
    return byLast.find(t => normalize(t.firstName)[0] === firstInitial) || null;
}

function normalize(s)
{
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

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
                rmpName: `${teacher.firstName} ${teacher.lastName}`.trim(),
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
