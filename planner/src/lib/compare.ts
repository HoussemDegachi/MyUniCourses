import { daysOnCampus, totalGapMinutes } from "@/lib/generator"
import type { Prof, Schedule, SectionType } from "@/types"

export interface Change {
  courseCode: string
  type: SectionType
  from: string | null // section code in the base schedule
  to: string
}

export interface Metric {
  label: string
  from: string
  to: string
  better: boolean | null // null when it didn't change
}

export interface Comparison {
  changedSectionIds: Set<string>
  changes: Change[]
  unitCount: number
  metrics: Metric[]
}

// Everything here is computed from the two schedules. Nothing is estimated.
export function compareSchedules(base: Schedule, other: Schedule, profs: Record<string, Prof | null>): Comparison {
  const baseKeys = new Set(base.units.map((u) => u.key))
  const changes: Change[] = other.units
    .filter((u) => !baseKeys.has(u.key))
    .map((u) => ({
      courseCode: u.courseCode,
      type: u.type,
      from: base.units.find((b) => b.courseCode === u.courseCode && b.type === u.type)?.sectionCode ?? null,
      to: u.sectionCode,
    }))

  const changedSectionIds = new Set(
    other.sections.filter((s) => !baseKeys.has(`${s.courseCode}|${s.sectionCode}`)).map((s) => s.id),
  )

  const metrics: Metric[] = [metric("Score", base.score, other.score, "higher")]

  const baseProfs = averageRating(base, profs)
  const otherProfs = averageRating(other, profs)
  if (baseProfs != null && otherProfs != null) {
    metrics.push(metric("Profs", baseProfs, otherProfs, "higher", (n) => n.toFixed(1)))
  }

  metrics.push(
    metric("Days on campus", daysOnCampus(base.sections).length, daysOnCampus(other.sections).length, "lower"),
    metric("Gaps", totalGapMinutes(base.sections) / 60, totalGapMinutes(other.sections) / 60, "lower", hours),
  )

  return { changedSectionIds, changes, unitCount: other.units.length, metrics }
}

function metric(label: string, from: number, to: number, want: "higher" | "lower", format = (n: number) => String(n)): Metric {
  const a = format(from)
  const b = format(to)
  return { label, from: a, to: b, better: a === b ? null : want === "higher" ? to > from : to < from }
}

function averageRating(s: Schedule, profs: Record<string, Prof | null>): number | null {
  const ratings = s.sections
    .filter((x) => x.type === "LEC" && x.prof)
    .map((x) => profs[x.prof!]?.rating)
    .filter((r): r is number => r != null)
  return ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null
}

function hours(n: number): string {
  const rounded = Math.round(n * 2) / 2
  return `${rounded}h`
}
