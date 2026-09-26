// Looks up a professor's RateMyProfessors rating. No packages needed, just Node 18+.
//
//   import { getRating } from "./rmp.js";
//   const rating = await getRating("University of Ottawa", "Fadi Malek");
//   // -> { name, school, department, avgRating, avgDifficulty, numRatings, wouldTakeAgainPercent, url } or null
//
// Or run it directly: node rmp.js
import readline from "node:readline/promises";
import { pathToFileURL } from "node:url";

// RateMyProfessors has no official API; this is the GraphQL endpoint its own website uses
const GRAPHQL_URL = "https://www.ratemyprofessors.com/graphql";

const SCHOOL_QUERY = `query SchoolSearch($query: SchoolSearchQuery!) {
  newSearch {
    schools(query: $query, first: 10) {
      edges { node { id legacyId name city state } }
    }
  }
}`;

const TEACHER_QUERY = `query TeacherSearch($query: TeacherSearchQuery!) {
  newSearch {
    teachers(query: $query, first: 10) {
      edges {
        node {
          legacyId
          firstName
          lastName
          department
          avgRating
          avgDifficulty
          numRatings
          wouldTakeAgainPercent
          school { name }
        }
      }
    }
  }
}`;

const schoolCache = new Map();
const ratingCache = new Map();

// "Dujmović, Vida" and "vida  dujmovic" both become "vida dujmovic"
function normalize(name)
{
    return name.normalize("NFD").replace(/[̀-ͯ]/g, "")
        .toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function isRealName(name)
{
    return typeof name === "string" && name.trim() !== "" && !/^(staff|tba|to be announced)$/i.test(name.trim());
}

async function graphql(query, variables)
{
    const res = await fetch(GRAPHQL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
        body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`RateMyProfessors returned ${res.status}`);
    const body = await res.json();
    if (body.errors?.length) throw new Error(body.errors[0].message);
    return body.data;
}

// Finds the school's RMP id from its name; exact name match first, otherwise the top result
async function findSchoolId(university)
{
    const key = normalize(university);
    if (schoolCache.has(key)) return schoolCache.get(key);

    const data = await graphql(SCHOOL_QUERY, { query: { text: university } });
    const schools = (data?.newSearch?.schools?.edges ?? []).map(e => e.node);
    const school = schools.find(s => normalize(s.name) === key) ?? schools[0] ?? null;
    const id = school ? school.id : null;
    schoolCache.set(key, id);
    return id;
}

// Exact name first, then first+last name, then a unique last-name match; most-rated wins ties
function pickTeacher(profName, teachers)
{
    const wanted = normalize(profName).split(" ");
    const first = wanted[0];
    const last = wanted[wanted.length - 1];
    const full = t => normalize(`${t.firstName} ${t.lastName}`);
    const byRatings = (a, b) => b.numRatings - a.numRatings;

    const exact = teachers.filter(t => full(t) === wanted.join(" "));
    if (exact.length) return exact.sort(byRatings)[0];

    const firstLast = teachers.filter(t =>
    {
        const parts = full(t).split(" ");
        return parts[0] === first && parts[parts.length - 1] === last;
    });
    if (firstLast.length) return firstLast.sort(byRatings)[0];

    const lastOnly = teachers.filter(t => normalize(t.lastName).split(" ").pop() === last);
    return lastOnly.length === 1 ? lastOnly[0] : null;
}

// Returns the professor's rating, or null if the school or professor isn't on RateMyProfessors
// (or the professor has no ratings yet)
async function getRating(university, profName)
{
    if (!isRealName(profName) || !university?.trim()) return null;
    const key = `${normalize(university)}|${normalize(profName)}`;
    if (ratingCache.has(key)) return ratingCache.get(key);

    const schoolId = await findSchoolId(university);
    if (!schoolId)
    {
        ratingCache.set(key, null);
        return null;
    }

    const data = await graphql(TEACHER_QUERY, { query: { text: profName, schoolID: schoolId, fallback: false } });
    const teachers = (data?.newSearch?.teachers?.edges ?? []).map(e => e.node);
    const match = pickTeacher(profName, teachers);

    const rating = match && match.numRatings > 0
        ? {
            name: `${match.firstName} ${match.lastName}`,
            school: match.school?.name ?? null,
            department: match.department,
            avgRating: match.avgRating,
            avgDifficulty: match.avgDifficulty,
            numRatings: match.numRatings,
            wouldTakeAgainPercent: match.wouldTakeAgainPercent >= 0 ? Math.round(match.wouldTakeAgainPercent) : null,
            url: `https://www.ratemyprofessors.com/professor/${match.legacyId}`,
        }
        : null;
    ratingCache.set(key, rating);
    return rating;
}

function getAllProfessors(courseData) {
    const profs = new Set();

    for (const subject in courseData) {
        for (const section of courseData[subject]) {
            for (const meeting of section.meetings) {
                if (meeting.instructor) {
                    profs.add(meeting.instructor);
                }
            }
        }
    }

    return [...profs];
}

export async function getAllProfsRatings(courseData) {
const allSections = Object.values(courseData).flat();
    if (!allSections.length) return;

    console.log("Looking up professors on RateMyProfessors...");
    const profRatings = {};
    for (const name of new Set(allSections.flatMap(s => s.meetings.map(m => m.instructor))))
    {
        const rating = await getRating("University of Ottawa", name);
        if (rating) profRatings[name] = rating.avgRating;
    }

    return profRatings
}