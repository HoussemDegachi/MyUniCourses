# AI schedule builder

Builds a uOttawa class schedule around the professors and times you actually want.

You pick your courses, describe what matters to you in plain English, and it returns
five conflict-free schedules ranked against what you asked for, each one with a
short write-up of what it gives you and what it costs you.

## What it does

- Pulls live course data from uoCampus, including labs, DGDs and tutorials
- Reads plain English preferences and turns them into weights you can see and adjust
- Scores schedules on professor ratings, class times, and gaps between classes
- Shows each professor's rating and an AI summary of their reviews on hover
- Lets you swap a single lab or DGD without disturbing the rest of your week
- Imports your work shifts or practices from a calendar file and plans around them
- Exports to .ics, or writes straight into your Google Calendar

## Getting started

Read `SETUP.md`. The short version: `npm install` and `npm run dev` in both
`backend` and `planner`. No accounts or keys are needed to see it work.

## Layout

```
backend/      Express API, uoCampus scraper, generator, Gemini, Auth0, Calendar
planner/      React frontend
SETUP.md      Full setup, including Gemini, Auth0 and Google Calendar
docs/         API reference, scraper notes, decisions, hackathon context
CLAUDE.md     Guidance for Claude Code working in this repo
```

## How the AI is used

Three calls, all server-side:

1. **Reading preferences.** Your sentence becomes structured settings, shown back to
   you as chips and sliders so you can see what it understood and correct it.
2. **Summarizing professors.** Reviews in, two or three plain sentences out.
3. **Explaining schedules.** The model is given facts already computed from the
   schedule, never the schedule itself, so it can only phrase what is already true.

The schedule building itself is a search algorithm, not a model. That is deliberate:
the part that has to be correct is code, and the part that has to read well is AI.
