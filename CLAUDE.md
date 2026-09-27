# CLAUDE.md

Guidance for Claude Code working in this repo.

## What this is

An AI-assisted class schedule builder for the University of Ottawa, built for
Hack the Hill III (Sept 25 to 27, 2026, uOttawa). A student picks courses,
describes what they want in plain English, and gets the best conflict-free schedule
plus a genuinely different alternative, ranked against those preferences, each with
professor ratings and a short write-up of the trade-offs.

Name: **myUni.Courses**, which is also the domain (earlier names: Profound, uschedule.ai). It is set in
`client/src/config.ts` (`APP_NAME`), `client/index.html` (`<title>`), and
`APP_NAME` in `backend/.env`, which names the Google Calendar it creates.
The Auth0 API identifier `https://profound.api` still carries the old name on
purpose: it is registered in the Auth0 tenant, and changing it breaks sign-in.

## Repo layout

```
backend/        Node + Express API. Scraper, generator, Gemini, Auth0, Calendar.
client/         React + TypeScript + Vite frontend.
SETUP.md        Full setup: running it, Gemini key, Auth0, Google Calendar.
docs/           Background that does not belong in code comments.
```

## Running it

Two terminals. Neither needs keys or accounts to start. Node 20.19+ or 22.12+:
Vite 8 needs it, and on older Node npm silently skips Vite's native bundler, so the
frontend won't start.

```
cd backend  && npm install && cp .env.example .env       && npm run dev   # :8080
cd client   && npm install && cp .env.example .env.local && npm run dev   # :5173
```

`USE_SAMPLE_DATA=true` in `backend/.env` skips uoCampus entirely and serves
built-in data. This is the demo-day safety switch.

`VITE_USE_MOCKS=true` in `client/.env.local` runs the frontend with no backend
at all.

## Commands

| Where | Command | Does |
|---|---|---|
| backend | `npm run dev` | server with `--watch` |
| backend | `node --check <file>` | syntax check (there is no test suite) |
| backend | `node scripts/build-course-list.js <term>` | rebuild `data/courses-<term>.json`, once per new term |
| client | `npm run dev` | Vite dev server |
| client | `npm run build` | typecheck then build |
| client | `npx tsc -b` | typecheck only |
| client | `npm run lint` | oxlint |

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
   |                              course search reads data/courses-<term>.json
   v
src/generator.js                  schedules, scoring, alternatives, facts
   |            \
   |             src/profs.js     every prof rating, through src/rmp.js (Rate My Professors)
   v
index.js (routes) --- src/gemini.js      callGemini, write-ups, prof summaries
                  \-- src/auth.js        verifies Auth0 access tokens
                  \-- src/calendar.js    Auth0 -> Google token -> Calendar writes
                  \-- routes/schedule.js POST /api/schedules/ai, a separate experiment:
                                         ai/generation.js has Gemini build the timetable
                                         and checks it with generator.js's own group rules.
                                         Sections, ratings and Gemini calls are the shared ones.
```

The frontend only ever talks to `client/src/api/client.ts`. All state lives in
`client/src/hooks/usePlanner.ts`. The frontend does not call `/api/schedules/ai`.

Course search never scrapes. uoCampus has no "list every course" page and a
whole-subject search stops at 300 sections (MAT, PHY, ADM and others go over), so
`scripts/build-course-list.js` builds `data/courses-<term>.json` ahead of time.
Sections are scraped one course at a time, which stays under the cap.

## Rules that matter

**Types are the contract.** `client/src/types.ts` defines every shape crossing
the wire. Change it and the backend at the same time, or things break silently.
Times are 24h strings (`"13:30"`). Days are `"MON"` to `"SUN"`.

**Vocabulary, used identically in both codebases:**
- *section*: one meeting pattern (days + time) of one component
- *unit*: every section sharing a course and section code, e.g. all of ITI1120 A01
- *group*: the letter shared by components you must take together, e.g. A
- *option*: one full way to take a course, one group with one unit per component

A group with no lecture is *shared*: PHY1731 has lecture A00 plus TUT X01, DGD Y01
and LAB Z13, and every lecture group takes one of each from those. So an option is a
lecture group plus one unit of each component only the shared groups offer.

**Two generators, kept in step.** `backend/src/generator.js` is authoritative.
`client/src/lib/generator.ts` is a port that powers mock mode and acts as a
fallback if the backend dies mid-demo. Change one, change the other.

**Gemini picks, the code checks.** Build sends the student's prompt, sliders, days off
and busy times to Gemini, which picks the sections (`buildSchedules` in
`ai/generation.js`). Every pick is checked with the generator's own rules
(`validateSchedule` on `groupProblems`) and scored by `generator.js`, never by
Gemini, and a bad answer is retried up to three times. When Gemini is off, fails or
runs out of quota, `generateSchedules` builds them instead; `builtBy` says which.
The write-ups still only phrase facts computed in code (`scheduleFacts`). There is no
separate "read my preferences" step any more.

**Gemini's free tier is small.** `gemini-3.8-flash` gets 20 requests a day, which
one demo run can use up, so the default model is `gemini-3.5-flash-lite`. Each build
is one to three Gemini calls plus one write-up per shown schedule; ratings for scoring
never go through it. Prof summaries are cached only when they succeed.

**One of everything.** Every Rate My Professors lookup goes through `src/profs.js`,
every Gemini call through `callGemini` in `src/gemini.js`, every section fetch through
`src/catalog.js`. The one deliberate duplicate is mock mode: the TypeScript generator
above and its sample data.

**Secrets stay server-side.** `GEMINI_API_KEY`, the Auth0 M2M secret and the
Google token never reach the browser. That is the whole reason the frontend
sends the prompt to `/api/schedules/generate` instead of calling Google directly.

**Cache aggressively.** uoCampus is slow and rate limited; Rate My Professors is
an undocumented endpoint. Courses cache 1h, terms 12h, professors 7 days, to
memory and to `.cache/`. Do not add a code path that scrapes per request.

**Never pair a real professor's name with invented data.** Names in
`backend/src/sample.js` and `client/src/api/mockData.ts` are fictional on
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

Working and tested end to end on live uoCampus data (Sept 26) and on sample data:

- course search by code or title across every subject, term selection, suggested first-year courses for six programs
- a plain-English prompt that goes straight to Gemini, which builds the schedules
- the best schedule plus a real alternative, scored on professors, times and gaps
- professor rating and AI review summary on hover
- swapping a single lab or DGD, with the score change shown
- .ics import (classes join the course list, other weekly events become busy blocks)
  and export with reading week and holidays left out, round-trip tested
- the page remembers courses, preferences, busy times and built schedules across a
  refresh (`localStorage`, key `uschedule-state-v1` in `usePlanner.ts`)
- Google Calendar push (code complete, needs an Auth0 tenant to try)
- conflict outlines, dark mode, full-screen layout with only the controls scrolling

Not done:

- Auth0 tenant and Google Cloud project are not set up. See `SETUP.md` sections 3D to 3F.
- Suggested courses are hardcoded in `backend/index.js` (`SEQUENCES`), checked against
  what uoCampus offers in 2026-27. Recheck them each year.
- Course lists exist for 2269 and 2271 only. A new term (Summer 2027) needs
  `node scripts/build-course-list.js <term>`; until then its search falls back to
  scraping one subject, which misses subjects over the 300-section cap.
- Term dates are confirmed for 2269 and 2271. Other terms are guessed from the season
  until a scrape corrects them (`backend/src/terms.js`).
- The public class search has no room numbers, so `location` is always null on live data.

## Before demoing

Read `docs/hackathon.md` for deadlines, prize categories and the pitch. Short
version: draft Devpost submission by midnight Saturday, final by 10am Sunday,
commit often from 10pm Friday so the history shows the work.
