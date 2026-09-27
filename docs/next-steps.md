# Next steps

Ordered by what unblocks the most. Item 2 is the only thing standing between this
repo and a complete demo.

## 1. Confirm the live scrape (done, Sept 26)

The live scrape works end to end: terms, course search, sections, schedules,
explanations, prof hover cards and swaps, all on real uoCampus data. `2269` (Fall
2026) and `2271` (Winter 2027) are the real term codes. What it turned up is in
`docs/scraper.md`.

Before judging, check your own Gemini quota: on the free tier `gemini-3.8-flash`
allows 20 requests a day, which is why the default is `gemini-3.5-flash-lite`.

## 2. Auth0 and Google Cloud

`SETUP.md` sections 3A to 3F. Roughly:

- A to C give sign-in, about 20 minutes, and satisfy the MLH Auth0 prize on their own
- D to F add the Google Calendar write, about another hour

The step everyone skips is enabling **Calendar** under Permissions on the Auth0
Google connection. Without it sign-in works and the push fails with
`GOOGLE_PERMISSION`.

The code for all of this is written and needs no changes.

## 3. Small things worth doing

**A real favicon.** Still the default emoji. The title is set to uschedule.ai.

**Register the domain.** GoDaddy Registry prize, five minutes.

## 4. If there is spare time

**Deploy it.** Frontend builds to static files; backend runs anywhere Node runs.
Remember to add the deployed URLs to Auth0's callback, logout and web origin
lists, and to `CORS_ORIGIN`. A live link in the Devpost submission helps.

**Save schedules per account.** The page already remembers everything in the
browser (`localStorage`). Auth0 gives you a stable `sub`; a tiny store keyed on it
would carry that across devices. Real feature, moderate work.

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
