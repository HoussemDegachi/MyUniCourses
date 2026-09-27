# Frontend

React + TypeScript + Vite + shadcn/ui + Tailwind v4 + Motion + Auth0.

Setup instructions for the whole project are in `../SETUP.md`.

## Run it

```
npm install
cp .env.example .env.local
npm run dev
```

Needs the backend on http://localhost:8080. To run with no backend at all, set
`VITE_USE_MOCKS=true` in `.env.local`.

## Layout

The page never scrolls. The controls column scrolls on its own, and the schedule
fills the rest of the screen. The week grid does that by positioning classes as
percentages of the day and by only showing the hours that actually contain
something, so it fits whatever height it is given.

## Where things are

```
src/
  types.ts                   Data shapes. Must match the backend exactly.
  config.ts                  App name, API URL, Auth0 keys, grid bounds, programs
  api/
    client.ts                Every backend call, and where the auth token is attached
    mocks.ts, mockData.ts    Offline sample mode
  hooks/
    usePlanner.ts            All app state and actions
    useAccount.ts            Sign-in state, works with or without Auth0 configured
  lib/
    generator.ts             Copy of the backend generator, for mock mode and fallback
    conflicts.ts             Overlap detection
    ics.ts                   .ics import and export
    time.ts, colors.ts       Helpers
  components/
    auth/                    Auth0 provider, sign-in button
    controls/                Term, courses, prompt, sliders, days off, status
    schedule/                Week grid, class blocks, tabs, explanation, swap dialog
    ics/                     Import dialog, calendar buttons
    ui/                      shadcn components (add more with npx shadcn add <name>)
```

## Design

A printed timetable you marked up with highlighters. Each course keeps one
highlighter colour across every option, so you can follow a course when you switch
tabs. The garnet accent is a quiet nod to uOttawa. Dark mode is supported.

## Before the demo

- Prof names in `mockData.ts` are invented. Never pair a real prof with a fake rating.
