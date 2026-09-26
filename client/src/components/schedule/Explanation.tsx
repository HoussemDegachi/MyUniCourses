import { TriangleAlertIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import type { Schedule } from "@/types"

interface Props {
  schedule: Schedule
  text: string | undefined
  loading: boolean
  courseCount: number
}

const PARTS = [
  { key: "prof", label: "Profs" },
  { key: "time", label: "Times" },
  { key: "gaps", label: "Gaps" },
] as const

export function Explanation({ schedule, text, loading, courseCount }: Props) {
  const placed = courseCount - schedule.unplaced.length
  return (
    <section className="grid gap-4 md:grid-cols-[1fr_14rem]" aria-live="polite">
      <div className="grid content-start gap-1.5">
        <h2 className="text-sm font-semibold">
          Why this schedule
          {courseCount > 0 && (
            <span className="ml-2 font-normal text-muted-foreground tabular">
              {placed} of {courseCount} course{courseCount === 1 ? "" : "s"} placed
            </span>
          )}
        </h2>
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
            <AlertTitle>Some courses didn't fit</AlertTitle>
            <AlertDescription>
              {schedule.unplaced.join(", ")} clash with your other choices or busy times. Allow waitlisted sections, remove a busy block, or pick
              a different course.
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
    </section>
  )
}
