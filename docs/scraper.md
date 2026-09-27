# The uoCampus scraper

`backend/scrapper/courseData.js`. Talks to the public class search:

```
https://uocampus.public.uottawa.ca/psc/csprpr9pub/EMPLOYEE/SA/c/UO_SR_AA_MODS.UO_PUB_CLSSRCH.GBL
```

## How it works

PeopleSoft keeps search state in cookies and hidden form fields, and Node's
`fetch` has no cookie jar, so each search runs its own small `Session` that
stores cookies and follows redirects by hand.

1. `openSearchPage` loads the form, retrying up to 5 times because the first hit
   is often a cookie-check page. Success is `#ICSID` being present.
2. `readForm` reads every hidden input and select into a field map.
3. `searchCourse` overrides the subject, catalogue number, term and the
   open-only checkbox, then POSTs the whole map back. Extra fields (year of study,
   component) can be passed to narrow the search.
4. `parseResults` walks the result divs with cheerio. Cells with several
   meetings separate them with `<br>`, which `lines()` splits.

Under load uoCampus sometimes answers with a blank page: no results and no
"No classes found" message. `searchCourse` treats that as a failed search and
retries it, rather than reporting a course with no sections.

Exports:

| Function | Returns |
|---|---|
| `getTerms()` | `[{ id, label }]` from the term dropdown |
| `getSections(term, subject, number)` | sections for one course |
| `getSubjectSections(term, subject)` | every course in a subject; only used for terms without a course list |
| `searchCourse`, `Session`, `readForm`, `openSearchPage` | the building blocks, used by `scripts/build-course-list.js` |

An empty catalogue number switches the match type from exact to contains, which
is how subject-wide search works.

## The 300-section cap, and the course lists

A search that would return more than 300 sections gives no results, just "Your
search will exceed the maximum limit of 300 sections". Whole-subject searches for
MAT, PHY, CHM, ADM and other big subjects hit it. Two consequences:

- **Sections are fetched one course at a time** (`sectionsFor` in `src/catalog.js`).
  No single course comes close to the cap.
- **Course search reads a prebuilt list**, `backend/data/courses-<term>.json`
  (`[{ "course": "MAT 1320", "title": "Calculus I" }]`), because uoCampus has no page
  that lists every course either.

`node scripts/build-course-list.js <term>` builds that list. It reads every subject
code from the "select subject" lookup (it pages by first letter), searches each
subject, splits a subject that hits the cap by year of study, and a year that
still hits it by component. About 3 to 5 minutes and a few hundred searches, run 8
at a time. Run it once per new term. `--subjects=ITI,MAT` does a quick partial run
that prints instead of saving.

The one known gap: first-year PHY labs are over 300 sections even on their own, so
a first-year PHY course with nothing but a lab would be missed. Every real one also
has a lecture, so none are. The script prints a warning when this happens.

## What the raw output looks like

Confirmed against the live site on Sept 26, 2026:

```js
{
  term: "2269",
  course: "PHY 1731",       // subject and number with a space; normalize.js removes it
  title: "Principes de physique I",
  section: "Z13",           // letters are the group, digits distinguish units
  component: "LAB",
  status: "Closed",         // image alt text: Open or Closed ("Wait List" is handled but wasn't seen)
  open: false,
  meetings: [{
    days: "Th",             // one day per meeting; each day of a MoWe lecture is its own meeting
    start: "10:00",
    end: "12:50",
    instructor: "Michael C. H. Wong",   // or "Staff"
    startDate: "2026-09-24",
    endDate: "2026-09-24",  // this lab runs on five single dates, listed as five identical meetings
    room: null              // the public search has no room column
  }]
}
```

`backend/src/normalize.js` converts that into `Section[]`. A section with two
meeting patterns becomes two `Section` objects sharing a `sectionCode`, which is
why the generator works in *units* rather than sections. Identical meetings (the
five lab dates above) collapse into one, otherwise the generator would see the unit
clash with itself and drop it.

Things the live data showed that the first version got wrong:

- **Groups without a lecture are shared.** PHY1731 has lecture A00, tutorial X01,
  DGDs Y01/Y02 and labs Z01 to Z20. X, Y and Z have no lecture; every student takes
  one of each alongside A00. The generator now treats lecture-less groups that way.
- **More component codes exist**: `TLB` (theory and lab), `PRA`, `REC`, `MTR`,
  `TST`, `ADM`. `normalize.js` maps each to the closest of the five frontend types
  instead of to `LEC`.
- **Titles can end in "(+1 combined)"** for cross-listed sections. The course list
  builder strips it.

Quick check:

```bash
cd backend
node -e "import('./scrapper/courseData.js').then(m => m.getSections(2269,'PHY',1731)).then(s => console.log(JSON.stringify(s, null, 2)))"
```

Then the same data through the normalizer:

```bash
node -e "
process.env.USE_SAMPLE_DATA='false';
import('./src/catalog.js').then(c => c.sectionsFor('2269',['PHY1731'])).then(s => console.log(s.slice(0,5)))
"
```

If the days, status or group come out wrong, fix `normalize.js` and nothing else.
That file exists precisely so the scrape format is isolated in one place.

## Being a good citizen

The scraper is cached hard: each course for an hour, terms for twelve, to memory
and to `.cache/`. A request for five courses runs at most four searches at a time.
Do not add a path that hits uoCampus per request. If they block us,
`USE_SAMPLE_DATA=true` keeps the project demoable.
