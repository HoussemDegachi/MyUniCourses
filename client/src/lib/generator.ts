// Client-side copy of the backend's generator (backend/src/generator.js).
// It powers the sample-data mode and stands in if the backend goes down mid-demo.
// Keep the two in step: same vocabulary, same scoring, same tiebreakers.
import type { Alternative, BusyBlock, Day, FreeTime, Preferences, Prof, Schedule, Section, Unit, Unplaced, UnplacedReason } from "@/types"
import { toMinutes } from "@/lib/time"

const MAX_RESULTS = 5
const MAX_EXPLORED = 200_000
const WALKING_MINUTES = 30
const GAP_BUDGET = 900
const ALT_SCORE_SLACK = 15

const STATUS_RANK: Record<string, number> = { OPEN: 0, WAITLIST: 1, CLOSED: 2 }

export function sectionsOverlap(a: Section, b: Section): boolean {
  return (
    a.days.some((d) => b.days.includes(d)) &&
    toMinutes(a.start) < toMinutes(b.end) &&
    toMinutes(b.start) < toMinutes(a.end)
  )
}

export function hitsBusy(s: Section, busy: BusyBlock[]): boolean {
  return busy.some(
    (b) => s.days.includes(b.day) && toMinutes(s.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(s.end),
  )
}

interface FullUnit extends Unit {
  sections: Section[]
}

export function buildUnits(sections: Section[]): FullUnit[] {
  const map = new Map<string, FullUnit>()
  for (const s of sections) {
    const key = `${s.courseCode}|${s.sectionCode}`
    let unit = map.get(key)
    if (!unit) {
      unit = {
        key,
        courseCode: s.courseCode,
        sectionCode: s.sectionCode,
        group: s.group,
        type: s.type,
        status: s.status,
        sections: [],
      }
      map.set(key, unit)
    }
    unit.sections.push(s)
    if (STATUS_RANK[s.status] > STATUS_RANK[unit.status]) unit.status = s.status
  }
  return [...map.values()].filter(
    (u) => !u.sections.some((a, i) => u.sections.slice(i + 1).some((b) => sectionsOverlap(a, b))),
  )
}

// A group with a lecture is a complete way to take the course. A group with no lecture
// (PHY1731's X01 TUT, Z13 LAB) is shared by every lecture group. Same rule as the backend.
function optionsForCourse(courseCode: string, units: FullUnit[], allowed: string[], busy: BusyBlock[]): FullUnit[][] {
  const course = units.filter((u) => u.courseCode === courseCode)
  const hasLecture = course.some((u) => u.type === "LEC")
  const complete = new Set(course.filter((u) => !hasLecture || u.type === "LEC").map((u) => u.group))
  const sharedTypes = new Set(course.filter((u) => !complete.has(u.group)).map((u) => u.type))

  const usable = course.filter((u) => allowed.includes(u.status) && !u.sections.some((s) => hitsBusy(s, busy)))

  const options: FullUnit[][] = []
  for (const group of complete) {
    // Required components come from everything offered, not just what is open.
    const ownTypes = new Set(course.filter((u) => u.group === group).map((u) => u.type))
    const choicesByType = [...ownTypes].map((type) => usable.filter((u) => u.group === group && u.type === type))
    for (const type of sharedTypes) {
      if (!ownTypes.has(type)) choicesByType.push(usable.filter((u) => !complete.has(u.group) && u.type === type))
    }
    if (choicesByType.some((choices) => choices.length === 0)) continue

    let combos: FullUnit[][] = [[]]
    for (const choices of choicesByType) {
      combos = combos.flatMap((combo) => choices.map((c) => [...combo, c]))
      if (combos.length > 400) combos = combos.slice(0, 400)
    }
    for (const combo of combos) {
      const all = combo.flatMap((u) => u.sections)
      if (all.some((a, i) => all.slice(i + 1).some((b) => sectionsOverlap(a, b)))) continue
      options.push(combo)
    }
  }
  return options
}

interface Input {
  courseCodes: string[]
  sections: Section[]
  preferences: Preferences
  busy: BusyBlock[]
  profs: Record<string, Prof>
}

interface Ranked extends Schedule {
  daysOnCampusCount: number
  gapMinutes: number
  missedDaysOff: number
  missedFreeTimes: number
}

export function generateSchedules({ courseCodes, sections, preferences, busy, profs }: Input): Schedule[] {
  const units = buildUnits(sections)
  const allowed = preferences.allowedStatus.length ? preferences.allowedStatus : ["OPEN", "WAITLIST"]

  const unplaced: Unplaced[] = []
  const perCourse: { code: string; options: FullUnit[][] }[] = []
  for (const code of [...new Set(courseCodes)]) {
    const options = optionsForCourse(code, units, allowed, busy)
    if (options.length === 0) unplaced.push(whyNoOptions(code, units, allowed, busy))
    else perCourse.push({ code, options })
  }

  perCourse.sort((a, b) => a.options.length - b.options.length)
  let found = search(perCourse)
  let blocked: { code: string; options: FullUnit[][] } | null = null

  if (found.length === 0 && perCourse.length > 1) {
    for (let i = 0; i < perCourse.length; i++) {
      const rest = search(perCourse.filter((_, j) => j !== i))
      if (rest.length > 0) {
        blocked = perCourse[i]
        found = rest
        break
      }
    }
  }

  const scored = found.map((combo) => finish(combo, preferences, profs)).sort(compare)

  // One tab per distinct set of lectures. Swapping a lab or DGD is its own decision.
  const byLectures = new Map<string, Ranked>()
  for (const schedule of scored) {
    const key = schedule.units
      .filter((u) => u.type === "LEC")
      .map((u) => u.key)
      .sort()
      .join(",")
    if (!byLectures.has(key)) byLectures.set(key, schedule)
  }

  // A blocked course clashes with different things in each schedule, so name them per schedule.
  return withAlternativeSecond([...byLectures.values()])
    .slice(0, MAX_RESULTS)
    .map((s, i) => ({
      ...s,
      id: `option-${i + 1}`,
      unplaced: blocked
        ? [
            ...unplaced,
            { courseCode: blocked.code, reason: "CLASH" as const, conflictsWith: overlappedCourses(blocked.options, s.sections) },
          ]
        : unplaced,
    }))
}

// Checked in the same order the filters run, so the first one that empties the list is the reason.
function whyNoOptions(code: string, units: FullUnit[], allowed: string[], busy: BusyBlock[]): Unplaced {
  const result = (reason: UnplacedReason, conflictsWith: string[] = []): Unplaced => ({ courseCode: code, reason, conflictsWith })

  const mine = units.filter((u) => u.courseCode === code)
  if (!mine.length) return result("NOT_OFFERED")

  const usable = mine.filter((u) => allowed.includes(u.status))
  if (!usable.length) {
    const waitlisted = mine.some((u) => u.status === "WAITLIST") && !allowed.includes("WAITLIST")
    return result(waitlisted ? "WAITLIST_ONLY" : "FULL")
  }

  if (optionsForCourse(code, units, allowed, []).length) {
    const titles = busy
      .filter((b) => usable.some((u) => u.sections.some((s) => hitsBusy(s, [b]))))
      .map((b) => b.title || "a busy block")
    return result("BUSY", [...new Set(titles)])
  }

  return result("CLASH")
}

function overlappedCourses(options: FullUnit[][], sections: Section[]): string[] {
  const hit = new Set<string>()
  for (const option of options) {
    for (const s of option.flatMap((u) => u.sections)) {
      for (const other of sections) if (sectionsOverlap(s, other)) hit.add(other.courseCode)
    }
  }
  return [...hit].sort()
}

// Second slot: the close-scoring schedule that shares the fewest units with the best.
function withAlternativeSecond(ranked: Ranked[]): Ranked[] {
  if (ranked.length < 3) return ranked
  const [best, ...rest] = ranked
  const bestKeys = new Set(best.units.map((u) => u.key))

  let pick: Ranked | null = null
  let pickDiff = -1
  for (const s of rest) {
    if (s.score < best.score - ALT_SCORE_SLACK || s.missedDaysOff > best.missedDaysOff) continue
    const diff = s.units.filter((u) => !bestKeys.has(u.key)).length / s.units.length
    if (diff > pickDiff) {
      pick = s
      pickDiff = diff
    }
  }

  if (!pick) return ranked
  return [best, pick, ...rest.filter((s) => s !== pick)]
}

function compare(a: Ranked, b: Ranked) {
  return (
    b.score - a.score ||
    a.missedDaysOff - b.missedDaysOff ||
    a.missedFreeTimes - b.missedFreeTimes ||
    a.daysOnCampusCount - b.daysOnCampusCount ||
    a.gapMinutes - b.gapMinutes
  )
}

function search(perCourse: { code: string; options: FullUnit[][] }[]): FullUnit[][] {
  const found: FullUnit[][] = []
  let explored = 0

  const walk = (i: number, picked: FullUnit[], pickedSections: Section[]) => {
    if (explored++ > MAX_EXPLORED || found.length > 4000) return
    if (i === perCourse.length) {
      found.push(picked)
      return
    }
    for (const option of perCourse[i].options) {
      const sections = option.flatMap((u) => u.sections)
      if (sections.some((s) => pickedSections.some((p) => sectionsOverlap(s, p)))) continue
      walk(i + 1, [...picked, ...option], [...pickedSections, ...sections])
    }
  }

  walk(0, [], [])
  return found
}

function finish(combo: FullUnit[], preferences: Preferences, profs: Record<string, Prof>): Ranked {
  const sections = combo.flatMap((u) => u.sections)
  const breakdown = scoreBreakdown(sections, preferences, profs)
  const w = preferences.weights
  const total = w.prof + w.time + w.gaps || 1
  const score = Math.round(((breakdown.prof * w.prof + breakdown.time * w.time + breakdown.gaps * w.gaps) / total) * 100)
  const days = daysOnCampus(sections)

  return {
    id: "",
    sections,
    units: combo.map(({ sections: _drop, ...unit }) => unit),
    score,
    breakdown,
    unplaced: [],
    daysOnCampusCount: days.length,
    gapMinutes: totalGapMinutes(sections),
    missedDaysOff: preferences.daysOff.filter((d) => days.includes(d)).length,
    missedFreeTimes: (preferences.freeTimes ?? []).filter((f) => sections.some((s) => inFreeTime(s, f.day, [f]))).length,
  }
}

// True when a class on this day runs into one of the times the student wants kept free.
export function inFreeTime(s: Section, day: Day, freeTimes: FreeTime[]): boolean {
  return freeTimes.some(
    (f) => f.day === day && s.days.includes(day) && toMinutes(s.start) < toMinutes(f.end) && toMinutes(f.start) < toMinutes(s.end),
  )
}

export function scoreBreakdown(sections: Section[], prefs: Preferences, profs: Record<string, Prof>) {
  const lectures = sections.filter((s) => s.type === "LEC")
  const ratings = lectures.map((s) => (s.prof && profs[s.prof]?.rating != null ? (profs[s.prof].rating! - 1) / 4 : 0.5))
  const prof = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0.5

  let meetings = 0
  let good = 0
  for (const s of sections) {
    for (const d of s.days) {
      meetings++
      const okStart = !prefs.earliestStart || toMinutes(s.start) >= toMinutes(prefs.earliestStart)
      const okEnd = !prefs.latestEnd || toMinutes(s.end) <= toMinutes(prefs.latestEnd)
      const okDay = !prefs.daysOff.includes(d)
      const okFree = !inFreeTime(s, d, prefs.freeTimes ?? [])
      if (okStart && okEnd && okDay && okFree) good++
    }
  }
  const time = meetings ? good / meetings : 1
  const gaps = Math.max(0, 1 - totalGapMinutes(sections) / GAP_BUDGET)

  return { prof, time, gaps }
}

export function totalGapMinutes(sections: Section[]): number {
  const byDay = new Map<Day, [number, number][]>()
  for (const s of sections) {
    for (const d of s.days) byDay.set(d, [...(byDay.get(d) ?? []), [toMinutes(s.start), toMinutes(s.end)]])
  }
  let total = 0
  for (const blocks of byDay.values()) {
    blocks.sort((a, b) => a[0] - b[0])
    for (let i = 1; i < blocks.length; i++) {
      const gap = blocks[i][0] - blocks[i - 1][1]
      if (gap > WALKING_MINUTES) total += gap
    }
  }
  return total
}

export function daysOnCampus(sections: Section[]): Day[] {
  const order: Day[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
  const used = new Set(sections.flatMap((s) => s.days))
  return order.filter((d) => used.has(d))
}

export function alternativesFor(
  unitKey: string,
  schedule: Schedule,
  sections: Section[],
  prefs: Preferences,
  busy: BusyBlock[],
  profs: Record<string, Prof>,
): Alternative[] {
  const units = buildUnits(sections)
  const current = units.find((u) => u.key === unitKey)
  if (!current) return []

  const kept = schedule.sections.filter((s) => `${s.courseCode}|${s.sectionCode}` !== unitKey)
  const w = prefs.weights
  const total = w.prof + w.time + w.gaps || 1

  return units
    .filter(
      (u) =>
        u.key !== unitKey &&
        u.courseCode === current.courseCode &&
        u.group === current.group &&
        u.type === current.type &&
        prefs.allowedStatus.includes(u.status as "OPEN" | "WAITLIST") &&
        !u.sections.some((s) => hitsBusy(s, busy)) &&
        !u.sections.some((s) => kept.some((k) => sectionsOverlap(s, k))),
    )
    .map((u) => {
      const breakdown = scoreBreakdown([...kept, ...u.sections], prefs, profs)
      const score = Math.round(
        ((breakdown.prof * w.prof + breakdown.time * w.time + breakdown.gaps * w.gaps) / total) * 100,
      )
      return { ...u, score, delta: score - schedule.score }
    })
    .sort((a, b) => b.score - a.score)
}
