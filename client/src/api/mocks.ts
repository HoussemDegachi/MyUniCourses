// Fake versions of every backend endpoint. Same inputs and outputs as the real API.
import type { Alternative, AlternativesRequest, Course, Explanation, GenerateRequest, Preferences, Prof, Schedule, Term } from "@/types"
import { COURSES, PROFS, SECTIONS, SEQUENCES, TERMS } from "@/api/mockData"
import { describeDetails } from "@/lib/analysis"
import { alternativesFor, daysOnCampus, generateSchedules, inFreeTime, totalGapMinutes } from "@/lib/generator"
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

export async function getProf(name: string): Promise<Prof | null> {
  await wait(200)
  return PROFS[name] ?? null
}

// Stand-in for Gemini. Picks up the common phrasings so the demo flow works.
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

// The request isn't used offline; the stand-in only states computed facts.
export async function explain(schedules: Schedule[], prefs: Preferences, _request = ""): Promise<Explanation[]> {
  await wait(700)
  const best = schedules[0]
  return schedules.map((s) => ({ scheduleId: s.id, text: describe(s, best, prefs), ...describeDetails(s, best, prefs, PROFS) }))
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

  for (const f of prefs.freeTimes ?? []) {
    const inIt = s.sections.filter((x) => inFreeTime(x, f.day, [f]))
    const when = `${DAY_LABEL[f.day]} ${formatTime(f.start)} to ${formatTime(f.end)}`
    parts.push(inIt.length ? `${inIt.map((x) => `${x.courseCode} ${x.type}`).join(" and ")} still ${inIt.length === 1 ? "falls" : "fall"} in ${when}.` : `${when} stays free.`)
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

  if (s.unplaced.length) parts.push(`Couldn't fit ${s.unplaced.map((u) => u.courseCode).join(", ")}.`)
  return parts.join(" ")
}
