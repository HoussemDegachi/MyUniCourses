# API

Base URL `http://localhost:8080`. JSON in, JSON out. Errors are
`{ "error": "...", "code": "..." }` with a matching HTTP status; `code` only
appears where the frontend branches on it.

Every shape below is defined in `planner/src/types.ts`. That file is the
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
Dates are guessed from the season until a real scrape corrects them.

### `GET /api/courses?term=2269&q=ITI`
`Course[]`. The query needs at least a three-letter subject, because uoCampus
searches one subject at a time. A bare subject code lists that subject rather
than matching titles.

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

Name matching is last name plus first initial. No match returns `null` rather
than guessing.

## Preferences

### `POST /api/preferences/parse`
```json
{ "prompt": "no classes before 10, Fridays off, good profs matter most",
  "current": { "...": "the Preferences object as it stands" } }
```
Returns a full `Preferences`. Gemini only changes what the prompt mentions;
`current` is passed so everything else survives. `501` when there is no key.

```json
{
  "earliestStart": "10:00", "latestEnd": null,
  "daysOff": ["FRI"],
  "allowedStatus": ["OPEN", "WAITLIST"],
  "weights": { "prof": 85, "time": 50, "gaps": 30 },
  "notes": ["You mentioned work. Import your shifts as a calendar."]
}
```

Weights are 0 to 100 and are relative, not absolute: the score is a weighted
average, so raising all three changes nothing.

## Schedules

### `POST /api/schedules/generate`
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
`{ schedules, preferences }` in, `[{ scheduleId, text }]` out. Gemini is given
facts computed by `scheduleFacts`, never the schedule. Falls back to
`describeSchedule` if the model fails or there is no key, so this endpoint never
errors.

### `POST /api/schedules/alternatives`
```json
{ "termId": "2269", "unitKey": "ITI1120|A01", "schedule": { }, "preferences": { }, "busy": [] }
```
Other times for that one component: same course, same group, same type, no clash
with anything else in the schedule. Each carries `score` and `delta` so the UI
can show whether the swap helps.

## Google Calendar

### `GET /api/calendar/status`
`{ "configured": true, "signedIn": false }`

### `POST /api/calendar/push`
Needs `Authorization: Bearer <Auth0 access token>`. Body `{ schedule, term }`.
Creates a new calendar named for the term and adds one weekly recurring event per
class.

```json
{ "calendarId": "...", "calendarName": "Profound: 2026 Fall Term", "created": 9, "failed": [] }
```

| Status | `code` | Means |
|---|---|---|
| 401 | | no or invalid token |
| 409 | `NO_GOOGLE` | signed in without Google |
| 403 | `GOOGLE_PERMISSION` | calendar scope not granted |
| 501 | | server has no Auth0 M2M credentials |
