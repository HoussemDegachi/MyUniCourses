// The calculated half of the full analysis: nothing here goes through the AI.
import { daysOnCampus, totalGapMinutes } from "@/lib/generator"
import { DAY_LABEL, formatTime, toMinutes } from "@/lib/time"
import type { Day, Preferences, Prof, Schedule } from "@/types"

export interface DayRow {
  day: Day
  firstStart: string
  lastEnd: string
  hoursOnCampus: number
  classes: number
  gapHours: number
}

export interface ProfRow {
  courseCode: string
  prof: string | null
  rating: number | null
  difficulty: number | null
  wouldTakeAgain: number | null
  numRatings: number | null
}

export interface PrefCheck {
  label: string
  detail: string
  kept: boolean
}

const hours = (mins: number) => Math.round((mins / 60) * 10) / 10

export function weekBreakdown(s: Schedule): DayRow[] {
  return daysOnCampus(s.sections).map((day) => {
    const today = s.sections.filter((x) => x.days.includes(day))
    const first = Math.min(...today.map((x) => toMinutes(x.start)))
    const last = Math.max(...today.map((x) => toMinutes(x.end)))
    const start = today.find((x) => toMinutes(x.start) === first)!.start
    const end = today.find((x) => toMinutes(x.end) === last)!.end
    return {
      day,
      firstStart: start,
      lastEnd: end,
      hoursOnCampus: hours(last - first),
      classes: today.length,
      gapHours: hours(totalGapMinutes(today)),
    }
  })
}

export function professorRows(s: Schedule, profs: Record<string, Prof | null>): ProfRow[] {
  return s.sections
    .filter((x) => x.type === "LEC")
    .map((x) => {
      const p = x.prof ? profs[x.prof] : null
      return {
        courseCode: x.courseCode,
        prof: x.prof,
        rating: p?.rating ?? null,
        difficulty: p?.difficulty ?? null,
        wouldTakeAgain: p?.wouldTakeAgain ?? null,
        numRatings: p?.numRatings ?? null,
      }
    })
}

// Only the preferences the student actually set. Unset ones aren't "kept".
export function preferenceChecks(s: Schedule, prefs: Preferences): PrefCheck[] {
  const days = daysOnCampus(s.sections)
  const meetings = s.sections.flatMap((x) => x.days.map(() => x))
  const checks: PrefCheck[] = []

  for (const d of prefs.daysOff) {
    const kept = !days.includes(d)
    checks.push({ label: `${DAY_LABEL[d]} off`, detail: kept ? "No classes that day" : "Has classes that day", kept })
  }
  if (prefs.earliestStart) {
    const early = meetings.filter((x) => toMinutes(x.start) < toMinutes(prefs.earliestStart!)).length
    checks.push({
      label: `Nothing before ${formatTime(prefs.earliestStart)}`,
      detail: early ? `${early} class${early === 1 ? " starts" : "es start"} earlier` : "Every class starts on time",
      kept: early === 0,
    })
  }
  if (prefs.latestEnd) {
    const late = meetings.filter((x) => toMinutes(x.end) > toMinutes(prefs.latestEnd!)).length
    checks.push({
      label: `Done by ${formatTime(prefs.latestEnd)}`,
      detail: late ? `${late} class${late === 1 ? " ends" : "es end"} later` : "Every class ends in time",
      kept: late === 0,
    })
  }
  const waitlisted = s.sections.filter((x) => x.status === "WAITLIST").length
  if (!prefs.allowedStatus.includes("WAITLIST")) {
    checks.push({ label: "Open sections only", detail: "No waitlisted sections", kept: waitlisted === 0 })
  }
  return checks
}

// Strengths and trade-offs without the AI, for mock mode. Mirrors describeDetails in
// backend/src/generator.js.
export function describeDetails(s: Schedule, best: Schedule, prefs: Preferences, profs: Record<string, Prof | null>) {
  const strengths: string[] = []
  const tradeoffs: string[] = []
  const list = (items: string[]) =>
    items.length <= 2 ? items.join(" and ") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

  const rated = professorRows(s, profs).filter((r): r is ProfRow & { prof: string; rating: number } => r.rating != null)
  const avg = rated.length ? Math.round((rated.reduce((a, r) => a + r.rating, 0) / rated.length) * 10) / 10 : null
  const top = [...rated].sort((a, b) => b.rating - a.rating)[0]
  if (avg != null && avg >= 4) strengths.push(`Strong professors, averaging ${avg} out of 5. ${top.prof} (${top.rating}) teaches ${top.courseCode}.`)
  const weak = rated.filter((r) => r.rating < 3)
  if (weak.length) tradeoffs.push(`${list(weak.map((r) => `${r.prof} (${r.rating}) for ${r.courseCode}`))} ${weak.length === 1 ? "is" : "are"} rated below 3 out of 5.`)

  const week = weekBreakdown(s)
  const gaps = totalGapMinutes(s.sections) / 60
  if (week.length <= 3) strengths.push(`Only ${plural(week.length, "day", "days")} on campus a week.`)
  if (gaps < 1) strengths.push("Almost no waiting between classes.")
  else if (gaps >= 4) tradeoffs.push(`About ${Math.round(gaps)} hours a week spent waiting between classes.`)

  const longest = week.reduce<DayRow | null>((a, d) => (!a || d.hoursOnCampus > a.hoursOnCampus ? d : a), null)
  if (longest && longest.hoursOnCampus >= 8) {
    tradeoffs.push(`${DAY_LABEL[longest.day]} is long: ${formatTime(longest.firstStart)} to ${formatTime(longest.lastEnd)}, ${longest.hoursOnCampus} hours on campus.`)
  }

  for (const c of preferenceChecks(s, prefs)) (c.kept ? strengths : tradeoffs).push(`${c.label}: ${c.detail.toLowerCase()}.`)

  const waitlisted = s.sections.filter((x) => x.status === "WAITLIST").map((x) => `${x.courseCode} ${x.sectionCode}`)
  if (waitlisted.length) tradeoffs.push(`Waitlisted: ${list([...new Set(waitlisted)])}. You may not get a seat.`)
  else strengths.push("Every section has open seats.")

  if (s.id !== best.id && best.score > s.score) tradeoffs.push(`Scores ${plural(best.score - s.score, "point", "points")} below your best match.`)
  return { strengths: strengths.slice(0, 4), tradeoffs: tradeoffs.slice(0, 4) }
}
