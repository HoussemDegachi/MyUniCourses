# Next steps

Ordered by what unblocks the most. Items 1 and 2 are the only things standing
between this repo and a complete demo.

## 1. Confirm the live scrape

Nothing has ever hit uoCampus from the build machine. Run this first:

```bash
cd backend
node -e "import('./scrapper/courseData.js').then(m => m.getCourseJSON(2269,'ITI',1120)).then(console.log)"
```

Check the day strings, status text and section codes against the assumptions in
`docs/scraper.md`. Anything wrong is fixed in `backend/src/normalize.js` alone.
Then set `USE_SAMPLE_DATA=false` and click through the app.

Also confirm the real term code. `2269` is a guess from the sample data.

## 2. Auth0 and Google Cloud

`SETUP.md` sections 3A to 3F. Roughly:

- A to C give sign-in, about 20 minutes, and satisfy the MLH Auth0 prize on their own
- D to F add the Google Calendar write, about another hour

The step everyone skips is enabling **Calendar** under Permissions on the Auth0
Google connection. Without it sign-in works and the push fails with
`GOOGLE_PERMISSION`.

The code for all of this is written and needs no changes.

## 3. Small things worth doing

**Suggested courses.** Only `cs-year1` exists, hardcoded in `backend/index.js`.
Adding a few more programs is copy-paste and makes the demo feel less narrow.

**Reading week.** Exported and pushed calendar events repeat weekly through the
whole term with no `EXDATE` for reading week or holidays. Honest and small to
fix if there is time.

**A real favicon.** Still the default emoji. The title is set to myUni.Courses.

**Register the domain.** GoDaddy Registry prize, five minutes.

## 4. If there is spare time

**Deploy it.** Frontend builds to static files; backend runs anywhere Node runs.
Remember to add the deployed URLs to Auth0's callback, logout and web origin
lists, and to `CORS_ORIGIN`. A live link in the Devpost submission helps.

**Save schedules per account.** Auth0 gives you a stable `sub`. A tiny store
keyed on it would let students come back to a schedule. Real feature, moderate
work.

**Show why a course could not be placed.** Right now `unplaced` names the course
but not the reason. "MAT1348 only runs during your Friday shift" would be better
than "couldn't fit MAT1348".

## 5. Where this goes after the hackathon

The idea that would actually make this stand out long-term, dropped as too large
for a weekend:

**Cross-registration between uOttawa and Carleton, with travel time between
campuses.** Students can take courses at the other school, no existing tool
schedules across both, and none account for the roughly 30 minutes of O-Train
between them. A back-to-back pair across campuses is impossible and nothing
currently catches it. That needs a second scraper and a travel model, and it is
the right next project rather than a weekend task.

Smaller but real: pulling program sequences from the uOttawa catalogue instead of
hardcoding them, and surfacing seat counts if a source for them can be found.
