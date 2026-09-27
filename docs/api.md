# API

Base URL `http://localhost:8080`. JSON in, JSON out. Errors are
`{ "error": "...", "code": "..." }` with a matching HTTP status; `code` only
appears where the frontend branches on it.

Every shape below is defined in `client/src/types.ts`. That file is the
contract: change it and the backend together.

Times are 24h strings, `"08:30"`. Days are `"MON"` to `"SUN"`. Status is
`"OPEN"`, `"WAITLIST"` or `"CLOSED"`; the UI only ever offers the first two.

## Course data

### `GET /api/health`
Which features are configured. The frontend uses this to disable the prompt box
and hide the Google Calendar button.

```json
{ "ok": true, "gemini": true, "auth": true, "googleCalendar": false, "liveCourseData": true }
```

### `GET /api/terms`
```json
[{ "id": "2269", "name": "2026 Fall Term", "startDate": "2026-09-09", "endDate": "2026-12-09" }]
```
Dates are confirmed for 2269 and 2271, from their scraped meetings. Other terms are
guessed from the season until a scrape corrects them.

### `GET /api/courses?term=2269&q=calcul`
`Course[]`, up to 40. Searches `backend/data/courses-<term>.json` by code or title,
across every subject, ignoring case and accents, so `calcul` finds both
"Calculus I" and "Calcul différentiel". A bare subject code (`ITI`, `iti1120`) only
matches codes. Codes that start with the query come first.

A term with no course list falls back to scraping the subject in the query, which
comes back empty for subjects over uoCampus's 300-section cap.

### `GET /api/sequences/cs-year1?term=2269`
`string[]` of course codes. Hardcoded in `backend/index.js`; only `cs-year1`
exists.

### `GET /api/sections?term=2269&courses=ITI1120,MAT1341`
`Section[]`. One entry per meeting pattern.

```json
{
  "id": "ITI1120-A00-LEC-0",
  "courseCode": "ITI1120",
  "sectionCode": "A00",
  "group": "A",
  "type": "LEC",
  "days": ["MON", "WED"],
  "start": "08:30",
  "end": "09:50",
  "prof": "Dana Moreau",
  "location": "MRT 205",
  "status": "OPEN"
}
```

## Professors

### `GET /api/profs/:name/summary`
`Prof` or `null`. Cached 7 days. `summary` is Gemini's write-up of the reviews
and is `null` when there is no key or no reviews.

```json
{
  "name": "Dana Moreau",
  "rmpName": "Dana Moreau",
  "rating": 4.6, "difficulty": 3.1, "wouldTakeAgain": 92, "numRatings": 88,
  "summary": "Explains code step by step...",
  "tags": ["Clear lectures", "Helpful"]
}
```

Names match on the full name, then first and last name, then a middle-name or
short-form match that only one prof fits. No match returns `null` rather than guessing.

## Preferences

There is no endpoint for these any more: the prompt goes to Gemini with the build.
Weights are 0 to 100 and are relative, not absolute: the score is a weighted
average, so raising all three changes nothing. For a time the student can never
make, import it as a busy calendar event: busy times are hard, the prompt is not.

## Schedules

### `POST /api/schedules/generate`
Body `{ termId, courseCodes, preferences, busy, prompt }`. Gemini picks the
sections from `prompt` and the settings; each schedule is then checked and scored in
code. With no key, or when Gemini fails, the generator builds them. `builtBy` is
`"gemini"` or `"generator"`.

```json
{ "termId": "2269", "courseCodes": ["ITI1120", "MAT1341"],
  "preferences": { }, "busy": [{ "id": "b1", "title": "Work", "day": "SAT", "start": "09:00", "end": "17:00" }] }
```
Returns up to 5 `Schedule`, best first, each a distinct set of lectures.

```json
{
  "id": "option-1",
  "sections": [],
  "units": [{ "key": "ITI1120|A00", "courseCode": "ITI1120", "sectionCode": "A00", "group": "A", "type": "LEC", "status": "OPEN" }],
  "score": 79,
  "breakdown": { "prof": 0.64, "time": 1, "gaps": 0.89 },
  "unplaced": []
}
```

`unplaced` holds courses that could not fit at all. If nothing fits together, the
generator finds the single blocking course, drops it and returns the rest.

### `POST /api/schedules/explain`
`{ schedules, preferences, request }` in, `[{ scheduleId, text }]` out. Gemini is
given facts computed by `scheduleFacts`, never the schedule. Falls back to
`describeSchedule` if the model fails or there is no key, so this endpoint never
errors.

`request` is optional: the student's own words from the prompt box. With it, the
write-up says whether the schedule gives them what they asked for. The facts include
`classTimesByDay` and `freeTimesMissed`, so it can name the class that sits in time
they wanted free.

### `POST /api/schedules/alternatives`
```json
{ "termId": "2269", "unitKey": "ITI1120|A01", "schedule": { }, "preferences": { }, "busy": [] }
```
Other times for that one component: same course, same group, same type, no clash
with anything else in the schedule. Each carries `score` and `delta` so the UI
can show whether the swap helps.

### `POST /api/schedules/ai`
A separate experiment the UI does not call: Gemini builds the timetable itself from
the scraped sections and Rate My Professors averages (`routes/schedule.js`,
`ai/generation.js`). It reads the same cached sections and ratings as the planner.
Every answer is checked in code, with the generator's own rules, for missing
components, mixed section letters, invented sections and time clashes; a bad answer is retried with
the problems listed, up to three tries.

```json
{ "term": 2269, "classes": ["ITI 1120", "MAT1320"], "prompt": "I'd like light Fridays",
  "weights": { "profRating": 80, "classTimes": 60, "fewerGaps": 40 },
  "time": { "start": "10:00", "end": "18:00" }, "daysOff": ["Fr"], "includeWaitlist": false }
```

`term` is a number. `classes` take either code format. `weights` accept `classTime`
or `classTimes`. `daysOff` use uoCampus codes (`Mo` to `Su`). `includeWaitlist: true`
lets full sections in.

Returns the best timetable that passed the check:

```json
{
  "overallScore": 91,
  "scores": { "profRating": 82, "classTimes": 100, "fewerGaps": 80, "daysOff": 100, "userRequest": 85 },
  "explanation": "...", "tradeoffs": [], "warnings": [],
  "sections": [{ "term": 2269, "course": "ITI 1120", "section": "A00", "component": "LEC", "status": "Open", "open": true, "meetings": [] }]
}
```

`scores` are Gemini's own estimates and can be wrong; `/generate` computes scores
in code. `400` on a bad body with a `details` list, `501` with no Gemini key, `500`
with the reason if no valid timetable came back.

## Google Calendar

### `GET /api/calendar/status`
`{ "configured": true, "signedIn": false }`

### `POST /api/calendar/push`
Needs `Authorization: Bearer <Auth0 access token>`. Body `{ schedule, term }`.
Creates a new calendar named for the term and adds one weekly recurring event per
class.

```json
{ "calendarId": "...", "calendarName": "myUni.Courses: 2026 Fall Term", "created": 9, "failed": [] }
```

| Status | `code` | Means |
|---|---|---|
| 401 | | no or invalid token |
| 409 | `NO_GOOGLE` | signed in without Google |
| 403 | `GOOGLE_PERMISSION` | calendar scope not granted |
| 501 | | server has no Auth0 M2M credentials |
