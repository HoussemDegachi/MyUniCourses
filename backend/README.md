# Backend

Node + Express. Serves course data scraped from uoCampus, professor ratings, the
schedule generator, the Gemini calls, and Google Calendar writes.

## Run it

```
npm install
cp .env.example .env     # fill in the keys you have
npm run dev
```

Starts on http://localhost:8080 and prints which features are switched on.

Nothing is required to start. Without `GEMINI_API_KEY` the prompt box turns itself
off and the sliders still work. Without Auth0, sign-in hides itself. With
`USE_SAMPLE_DATA=true` it never touches uoCampus at all.

## Endpoints

| Method | Path | Returns |
|---|---|---|
| GET | `/api/health` | which features are configured |
| GET | `/api/terms` | `Term[]` |
| GET | `/api/courses?term=&q=` | `Course[]` |
| GET | `/api/sequences/:program?term=` | course codes for a program's suggested load |
| GET | `/api/sections?term=&courses=A,B` | `Section[]` |
| GET | `/api/profs/:name/summary` | `Prof` or `null` |
| POST | `/api/preferences/parse` | `Preferences` |
| POST | `/api/schedules/generate` | `Schedule[]`, best first, max 5 |
| POST | `/api/schedules/explain` | `Explanation[]` |
| POST | `/api/schedules/alternatives` | `Alternative[]` for one component |
| GET | `/api/calendar/status` | whether calendar push is available |
| POST | `/api/calendar/push` | writes the schedule to Google Calendar (needs sign-in) |

Shapes live in `planner/src/types.ts`. Times are 24h strings like `"13:30"`, days
are `"MON"` to `"SAT"`.

## How the pieces fit

```
scrapper/courseData.js   talks to uoCampus (PeopleSoft), returns raw sections
src/normalize.js         raw sections  ->  the shape the frontend expects
src/catalog.js           caching layer over the scraper, falls back to sample data
src/terms.js             term names and dates
src/generator.js         schedules, scoring, alternatives, facts for the AI
src/rmp.js               Rate My Professors lookup
src/gemini.js            the three AI calls, and nothing else touches Gemini
src/auth.js              verifies Auth0 access tokens
src/calendar.js          Auth0 -> Google token -> Calendar writes
src/lib/cache.js         memory plus disk cache, so restarts stay fast
src/sample.js            built-in data for when uoCampus is unreachable
```

## Caching

Scraped subjects last an hour, terms twelve hours, professor lookups a week. The
cache is in `.cache/` and survives restarts. Delete that folder to force a refresh.

This matters: uoCampus is slow and rate limited, and Rate My Professors is an
undocumented endpoint we should touch as little as possible.

## Notes on the AI

Gemini only reads the student's words and writes sentences. It never invents a
rating, a time or a score. Everything factual is computed in `generator.js` and
passed into the prompt, so the model can only phrase what is already true. If a
judge asks how you stop it hallucinating, that is the answer.
