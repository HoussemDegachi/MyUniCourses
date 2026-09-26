# CLAUDE.md

Guidance for Claude Code working in this repo.

## What this is

An AI-assisted class schedule builder for the University of Ottawa, built for
Hack the Hill III (Sept 25 to 27, 2026, uOttawa). A student picks courses,
describes what they want in plain English, and gets five conflict-free schedules
ranked against those preferences, each with professor ratings and a short
write-up of the trade-offs.

Working name: **Profound**. Not final. It is set in exactly two places:
`planner/src/config.ts` (`APP_NAME`) and `planner/index.html` (`<title>`).

## Repo layout

```
backend/        Node + Express API. Scraper, generator, Gemini, Auth0, Calendar.
planner/        React + TypeScript + Vite frontend.
SETUP.md        Full setup: running it, Gemini key, Auth0, Google Calendar.
docs/           Background that does not belong in code comments.
```

## Running it

Two terminals. Neither needs keys or accounts to start.

```
cd backend  && npm install && cp .env.example .env       && npm run dev   # :8080
cd planner  && npm install && cp .env.example .env.local && npm run dev   # :5173
```

`USE_SAMPLE_DATA=true` in `backend/.env` skips uoCampus entirely and serves
built-in data. This is the demo-day safety switch.

`VITE_USE_MOCKS=true` in `planner/.env.local` runs the frontend with no backend
at all.

## Commands

| Where | Command | Does |
|---|---|---|
| backend | `npm run dev` | server with `--watch` |
| backend | `node --check <file>` | syntax check (there is no test suite) |
| planner | `npm run dev` | Vite dev server |
| planner | `npm run build` | typecheck then build |
| planner | `npx tsc -b` | typecheck only |
| planner | `npm run lint` | oxlint |

There are no automated tests. Verify by running both servers and clicking
through: add courses, build, hover a class, swap a DGD, export .ics.

## Architecture

```
uoCampus (PeopleSoft)
   |  scrapper/courseData.js      cookie session, form POST, cheerio parse
   v
src/normalize.js                  raw scrape -> the shape the frontend expects
   |
src/catalog.js                    caching layer, falls back to src/sample.js
   v
src/generator.js                  schedules, scoring, alternatives, facts
   |            \
   |             src/rmp.js       Rate My Professors lookup
   v
index.js (routes) --- src/gemini.js      three AI calls, nothing else touches Gemini
                  \-- src/auth.js        verifies Auth0 access tokens
                  \-- src/calendar.js    Auth0 -> Google token -> Calendar writes
```

The frontend only ever talks to `planner/src/api/client.ts`. All state lives in
`planner/src/hooks/usePlanner.ts`.

## Rules that matter

**Types are the contract.** `planner/src/types.ts` defines every shape crossing
the wire. Change it and the backend at the same time, or things break silently.
Times are 24h strings (`"13:30"`). Days are `"MON"` to `"SUN"`.

**Vocabulary, used identically in both codebases:**
- *section*: one meeting pattern (days + time) of one component
- *unit*: every section sharing a course and section code, e.g. all of ITI1120 A01
- *group*: the letter shared by components you must take together, e.g. A
- *option*: one full way to take a course, one group with one unit per component

**Two generators, kept in step.** `backend/src/generator.js` is authoritative.
`planner/src/lib/generator.ts` is a port that powers mock mode and acts as a
fallback if the backend dies mid-demo. Change one, change the other.

**The AI never invents facts.** Gemini gets facts already computed by
`generator.js` (`scheduleFacts`), never the schedule itself. It phrases; it does
not calculate. Preference parsing uses a JSON response schema and only changes
what the student mentioned. This is the answer to "how do you stop it
hallucinating", so do not loosen it.

**Secrets stay server-side.** `GEMINI_API_KEY`, the Auth0 M2M secret and the
Google token never reach the browser. That is the whole reason the frontend
calls `/api/preferences/parse` instead of Google directly.

**Cache aggressively.** uoCampus is slow and rate limited; Rate My Professors is
an undocumented endpoint. Subjects cache 1h, terms 12h, professors 7 days, to
memory and to `.cache/`. Do not add a code path that scrapes per request.

**Never pair a real professor's name with invented data.** Names in
`backend/src/sample.js` and `planner/src/api/mockData.ts` are fictional on
purpose.

**Degrade, do not crash.** No Gemini key means the prompt box disables itself and
the sliders still work. No Auth0 means sign-in hides. uoCampus unreachable means
sample data. Keep that property.

## Code style

- Plain, direct comments that explain *why*, not *what*. No em dashes.
- Backend is Allman brace style (braces on their own line), 4 spaces. It was
  written that way in `scrapper/courseData.js`; match it.
- Frontend is Prettier-ish, 2 spaces, no semicolons.
- User-facing copy: plain language, active voice, no apologies. Errors say what
  happened and what to do. See the existing toasts for the register.

## Current state

Working and tested end to end on sample data:

- course search, term selection, suggested first-year CS courses
- plain-English preferences with the sliders animating to what was understood
- five distinct schedules, scored on professors, times and gaps
- professor rating and AI review summary on hover
- swapping a single lab or DGD, with the score change shown
- .ics import (weekly events become busy blocks) and export, round-trip tested
- Google Calendar push (code complete, needs an Auth0 tenant to try)
- conflict outlines, dark mode, full-screen layout with only the controls scrolling

Not done:

- Auth0 tenant and Google Cloud project are not set up. See `SETUP.md` sections 3D to 3F.
- The live uoCampus scrape has never been run from this machine (network blocked).
  `parseDays`, `parseStatus` and section-code parsing in `normalize.js` are written
  against the format the scraper implies and need one real run to confirm.
- Only `cs-year1` exists in the suggested-courses map, hardcoded in `backend/index.js`.
- Term start and end dates are guessed from the season until a real scrape
  corrects them (`backend/src/terms.js`).

## Before demoing

Read `docs/hackathon.md` for deadlines, prize categories and the pitch. Short
version: draft Devpost submission by midnight Saturday, final by 10am Sunday,
commit often from 10pm Friday so the history shows the work.
