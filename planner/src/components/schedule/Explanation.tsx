import { useState } from "react"
import { ListChecksIcon, TriangleAlertIcon } from "lucide-react"
import { AnalysisDialog } from "@/components/schedule/AnalysisDialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { Comparison } from "@/lib/compare"
import type { Explanation as Analysis, Preferences, Prof, Schedule, Unplaced } from "@/types"

interface Props {
  title: string // "Best match" or "Alternative"
  schedule: Schedule
  analysis: Analysis | undefined
  loading: boolean
  courseCount: number
  preferences: Preferences
  profs: Record<string, Prof | null>
  comparison: Comparison | null
  onAllowWaitlist?: () => void
}

function listOf(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ""
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`
}

// Each line says what happened and what to do about it.
function reasonText(u: Unplaced): string {
  switch (u.reason) {
    case "NOT_OFFERED":
      return "isn't offered this term. Check the term, or pick a different course."
    case "FULL":
      return "is full in every section. Pick a different course, or check again later as seats open up."
    case "WAITLIST_ONLY":
      return "only has waitlisted sections left."
    case "BUSY":
      return u.conflictsWith.length
        ? `overlaps ${listOf(u.conflictsWith)} in every section. Remove or shorten that busy time to fit it.`
        : "overlaps your busy times in every section."
    case "CLASH":
      return u.conflictsWith.length
        ? `overlaps ${listOf(u.conflictsWith)} in this schedule, whichever section you take. Try the other option or drop one of them.`
        : "has no set of sections that fit together without overlapping."
  }
}

const PARTS = [
  { key: "prof", label: "Profs" },
  { key: "time", label: "Times" },
  { key: "gaps", label: "Gaps" },
] as const

export function Explanation({
  title,
  schedule,
  analysis,
  loading,
  courseCount,
  preferences,
  profs,
  comparison,
  onAllowWaitlist,
}: Props) {
  const [open, setOpen] = useState(false)
  const placed = courseCount - schedule.unplaced.length
  const text = analysis?.text
  return (
    <section className="grid gap-4 md:grid-cols-[1fr_14rem]" aria-live="polite">
      <div className="grid content-start gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2">
          <h2 className="text-sm font-semibold">
            Why this schedule
            {courseCount > 0 && (
              <span className="ml-2 font-normal text-muted-foreground tabular">
                {placed} of {courseCount} course{courseCount === 1 ? "" : "s"} placed
              </span>
            )}
          </h2>
          <Button variant="link" size="sm" className="h-auto p-0 text-primary" onClick={() => setOpen(true)}>
            <ListChecksIcon />
            Full analysis
          </Button>
        </div>
        {loading && !text ? (
          <div className="grid gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ) : (
          <p className="max-w-prose text-sm leading-relaxed">{text ?? "No explanation for this option."}</p>
        )}
        {schedule.unplaced.length > 0 && (
          <Alert variant="destructive" className="mt-2">
            <TriangleAlertIcon />
            <AlertTitle>
              {schedule.unplaced.length === 1 ? "1 course didn't fit" : `${schedule.unplaced.length} courses didn't fit`}
            </AlertTitle>
            <AlertDescription>
              <ul className="grid gap-1">
                {schedule.unplaced.map((u) => (
                  <li key={u.courseCode}>
                    <span className="font-semibold text-foreground">{u.courseCode}</span> {reasonText(u)}
                  </li>
                ))}
              </ul>
              {onAllowWaitlist && schedule.unplaced.some((u) => u.reason === "WAITLIST_ONLY") && (
                <Button size="sm" variant="outline" className="mt-2" onClick={onAllowWaitlist}>
                  Allow waitlisted sections
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
      </div>

      <dl className="grid content-start gap-2.5">
        {PARTS.map(({ key, label }) => {
          const pct = Math.round(schedule.breakdown[key] * 100)
          return (
            <div key={key} className="grid grid-cols-[3.5rem_1fr_2.25rem] items-center gap-2 text-sm">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
              </dd>
              <dd className="text-right tabular">{pct}</dd>
            </div>
          )
        })}
      </dl>
      <AnalysisDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        schedule={schedule}
        analysis={analysis}
        preferences={preferences}
        profs={profs}
        comparison={comparison}
      />
    </section>
  )
}
