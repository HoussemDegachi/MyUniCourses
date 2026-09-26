// Fake versions of every backend endpoint. Same inputs and outputs as the real API.
import type { Alternative, AlternativesRequest, Course, Day, Explanation, GenerateRequest, Preferences, Prof, Schedule, Section, Term } from "@/types"
import { COURSES, PROFS, SECTIONS, SEQUENCES, TERMS } from "@/api/mockData"
import { alternativesFor, daysOnCampus, generateSchedules, totalGapMinutes } from "@/lib/generator"
import { DAY_LABEL, fromMinutes, formatTime, toMinutes } from "@/lib/time"

const wait = (ms = 400) => new Promise((r) => setTimeout(r, ms))

export async function getTerms(): Promise<Term[]> {
  await wait(150)
  return TERMS
}

export async function searchCourses(_termId: string, query: string): Promise<Course[]> {
  await wait(120)
  const q = query.trim().toLowerCase()
  if (!q) return COURSES
  return COURSES.filter((c) => c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q))
}

export async function getSequence(program: string, termId: string): Promise<string[]> {
  await wait(150)
  return SEQUENCES[program]?.byTerm[termId] ?? []
}

export async function getSections(_termId: string, courseCodes: string[]): Promise<Section[]> {
  await wait(150)
  return SECTIONS.filter((s) => courseCodes.includes(s.courseCode))
}

export async function getProf(name: string): Promise<Prof | null> {
  await wait(200)
  return PROFS[name] ?? null
}

// Stand-in for Gemini. Picks up the common phrasings so the demo flow works.
export async function parsePreferences(prompt: string, current: Preferences): Promise<Preferences> {
  await wait(900)
  const text = prompt.toLowerCase()
  const next: Preferences = { ...current, daysOff: [...current.daysOff], weights: { ...current.weights }, notes: [] }

  const before = text.match(/(?:before|earlier than)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/)
  if (before) next.earliestStart = clock(before[1], before[2], before[3], "am")

  const after = text.match(/(?:after|later than|past)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/)
  if (after) next.latestEnd = clock(after[1], after[2], after[3], "pm")

  const days: [RegExp, Day][] = [
    [/monday|mondays/, "MON"],
    [/tuesday|tuesdays/, "TUE"],
    [/wednesday|wednesdays/, "WED"],
    [/thursday|thursdays/, "THU"],
    [/friday|fridays/, "FRI"],
  ]
  for (const [re, day] of days) {
    const m = text.match(re)
    if (!m) continue
    const around = text.slice(Math.max(0, m.index! - 25), m.index! + 25)
    if (/\b(no|off|free|avoid|without)\b/.test(around) && !next.daysOff.includes(day)) next.daysOff.push(day)
  }

  if (/\b(prof|profs|professor|teacher|rating|ratings)\b/.test(text)) next.weights.prof = 85
  if (/\b(gap|gaps|back to back|back-to-back|compact)\b/.test(text)) next.weights.gaps = 80
  if (/\b(sleep|morning|early|late|evening|night)\b/.test(text)) next.weights.time = Math.max(next.weights.time, 75)
  if (/\b(don'?t care|doesn'?t matter)\b.*\bprof/.test(text)) next.weights.prof = 20

  next.allowedStatus = /\bwaitlist/.test(text) && /\b(no|avoid|don'?t)\b/.test(text) ? ["OPEN"] : next.allowedStatus

  if (/\bwork|job|shift/.test(text)) next.notes.push("You mentioned work. Import your shifts as a calendar so classes avoid them.")

  return next
}

function clock(h: string, m: string | undefined, ampm: string | undefined, fallback: "am" | "pm"): string {
  let hour = Number(h)
  const suffix = ampm ?? (hour >= 1 && hour <= 7 ? "pm" : fallback)
  if (suffix === "pm" && hour < 12) hour += 12
  if (suffix === "am" && hour === 12) hour = 0
  return fromMinutes(hour * 60 + Number(m ?? 0))
}

export async function generate(req: GenerateRequest): Promise<Schedule[]> {
  await wait(600)
  return generateSchedules({
    courseCodes: req.courseCodes,
    sections: SECTIONS.filter((s) => req.courseCodes.includes(s.courseCode)),
    preferences: req.preferences,
    busy: req.busy,
    profs: PROFS,
  })
}

// Stand-in for Gemini's explanation. Only states facts computed from the schedule,
// which is the same rule the real prompt should follow.
export async function alternatives(req: AlternativesRequest): Promise<Alternative[]> {
  await wait(300)
  return alternativesFor(
    req.unitKey,
    req.schedule,
    SECTIONS.filter((s) => req.schedule.sections.some((x) => x.courseCode === s.courseCode)),
    req.preferences,
    req.busy,
    PROFS,
  )
}

export async function explain(schedules: Schedule[], prefs: Preferences): Promise<Explanation[]> {
  await wait(700)
  const best = schedules[0]
  return schedules.map((s) => ({ scheduleId: s.id, text: describe(s, best, prefs) }))
}

function describe(s: Schedule, best: Schedule, prefs: Preferences): string {
  const parts: string[] = []
  const lecs = s.sections.filter((x) => x.type === "LEC" && x.prof && PROFS[x.prof]?.rating != null)
  const avg = lecs.length ? lecs.reduce((a, x) => a + PROFS[x.prof!].rating!, 0) / lecs.length : null
  const days = daysOnCampus(s.sections)
  const gapHours = totalGapMinutes(s.sections) / 60
  const earliest = s.sections.reduce((m, x) => Math.min(m, toMinutes(x.start)), 24 * 60)

  if (avg != null) {
    const top = [...lecs].sort((a, b) => PROFS[b.prof!].rating! - PROFS[a.prof!].rating!)[0]
    parts.push(`Your profs average ${avg.toFixed(1)} out of 5, with ${top.prof} (${PROFS[top.prof!].rating}) for ${top.courseCode}.`)
  }

  parts.push(`You're on campus ${days.length} day${days.length === 1 ? "" : "s"} a week${gapHours >= 1 ? ` with about ${Math.round(gapHours)} hours of gaps between classes` : " with almost no gaps"}.`)

  const missed = prefs.daysOff.filter((d) => days.includes(d))
  if (prefs.daysOff.length) {
    parts.push(missed.length ? `It doesn't keep ${missed.map((d) => DAY_LABEL[d]).join(" and ")} free.` : `${prefs.daysOff.map((d) => DAY_LABEL[d]).join(" and ")} ${prefs.daysOff.length === 1 ? "stays" : "stay"} free.`)
  }

  if (prefs.earliestStart && earliest < toMinutes(prefs.earliestStart)) {
    parts.push(`Trade-off: your earliest class starts at ${formatTime(fromMinutes(earliest))}.`)
  }

  const waitlisted = s.sections.filter((x) => x.status === "WAITLIST").length
  if (waitlisted) parts.push(`${waitlisted} section${waitlisted === 1 ? " is" : "s are"} waitlisted.`)

  if (s.id !== best.id && best.score > s.score) {
    const diff = best.score - s.score
    parts.push(`Scores ${diff} point${diff === 1 ? "" : "s"} below the top option.`)
  }

  if (s.unplaced.length) parts.push(`Couldn't fit ${s.unplaced.join(", ")}.`)
  return parts.join(" ")
}
