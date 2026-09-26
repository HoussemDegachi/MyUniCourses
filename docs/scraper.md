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
   open-only checkbox, then POSTs the whole map back.
4. `parseResults` walks the result divs with cheerio. Cells with several
   meetings separate them with `<br>`, which `lines()` splits.

Exports:

| Function | Returns |
|---|---|
| `getTerms()` | `[{ id, label }]` from the term dropdown |
| `getSections(term, subject, number)` | sections for one course |
| `getSubjectSections(term, subject)` | every course in a subject, powers search |
| `getCourseJSON(...)` | the same as a JSON string |

An empty catalogue number switches the match type from exact to contains, which
is how subject-wide search works.

## What the raw output looks like

```js
{
  term: "2269",
  course: "ITI1120",
  title: "Introduction to Computing I",
  section: "A00",          // letters are the group, digits distinguish components
  component: "LEC",
  status: "Open",          // image alt text: Open, Closed, Wait List
  open: true,
  meetings: [{
    days: "MoWe",          // concatenated two-letter codes, no separator
    start: "08:30",
    end: "17:20",
    instructor: "Dana Moreau",   // or "Staff", or empty
    startDate: "2026-09-09",
    endDate: "2026-12-09",
    room: "MRT 205"
  }]
}
```

`backend/src/normalize.js` converts that into `Section[]`. A section with two
meeting patterns becomes two `Section` objects sharing a `sectionCode`, which is
why the generator works in *units* rather than sections.

## Unverified

**This has never been run against the live site from the build machine, because
outbound network was restricted.** Everything below is inferred from the parsing
code and should be confirmed on a real run, ideally the first thing you do:

- Day strings really are `"MoWe"` with no separator (`parseDays` assumes so)
- Status alt text really is `Open` / `Closed` / `Wait List` (`parseStatus`)
- Section codes really are letter-then-digits like `A00` (`parseGroup`)
- Component codes are `LEC`, `DGD`, `LAB`, `TUT`, `SEM`. `normalize.js` maps a
  few extras and falls back to `LEC`, which may be wrong for something unusual
- `MTG_ROOM$n` is the right element id for the room

Quick check:

```bash
cd backend
node -e "import('./scrapper/courseData.js').then(m => m.getCourseJSON(2269,'ITI',1120)).then(console.log)"
```

Then the same data through the normalizer:

```bash
node -e "
process.env.USE_SAMPLE_DATA='false';
import('./src/catalog.js').then(c => c.sectionsFor('2269',['ITI1120'])).then(s => console.log(s.slice(0,3)))
"
```

If the days, status or group come out wrong, fix `normalize.js` and nothing else.
That file exists precisely so the scrape format is isolated in one place.

## Being a good citizen

The scraper is cached hard: subjects for an hour, terms for twelve, to memory and
to `.cache/`. Do not add a path that hits uoCampus per request. If they block us,
`USE_SAMPLE_DATA=true` keeps the project demoable.
