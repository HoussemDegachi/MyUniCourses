import type { ReactNode } from "react"
import { ArrowRightIcon, CheckIcon, CircleAlertIcon, SparklesIcon, XIcon } from "lucide-react"
import { ScrollPanel } from "@/components/controls/ScrollPanel"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { preferenceChecks, professorRows, weekBreakdown } from "@/lib/analysis"
import type { Comparison } from "@/lib/compare"
import { DAY_LABEL, formatTime } from "@/lib/time"
import { cn } from "@/lib/utils"
import type { Explanation, Preferences, Prof, Schedule } from "@/types"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  schedule: Schedule
  analysis: Explanation | undefined
  preferences: Preferences
  profs: Record<string, Prof | null>
  comparison: Comparison | null
}

export function AnalysisDialog({ open, onOpenChange, title, schedule, analysis, preferences, profs, comparison }: Props) {
  const week = weekBreakdown(schedule)
  const professors = professorRows(schedule, profs)
  const checks = preferenceChecks(schedule, preferences)
  const totalHours = Math.round(week.reduce((a, d) => a + d.hoursOnCampus, 0) * 10) / 10
  const totalGaps = Math.round(week.reduce((a, d) => a + d.gapHours, 0) * 10) / 10

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The header stays put; only the body scrolls, with the same scrollbar and
          progress line as the side panel. */}
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
          <DialogTitle className="flex items-baseline gap-2">
            {title}
            <span className="text-sm font-normal text-muted-foreground tabular">scores {schedule.score} out of 100</span>
          </DialogTitle>
          <DialogDescription>
            Everything that shapes this week, so you can decide before you register.
          </DialogDescription>
        </DialogHeader>

        <ScrollPanel className="grid min-h-0 flex-1 gap-6 overflow-y-auto px-6 pb-6">
          {/* AI-written, from computed facts */}
          <section className="grid gap-3">
            {analysis ? (
              <p className="leading-relaxed">{analysis.text}</p>
            ) : (
              <div className="grid gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Points title="What you get" items={analysis?.strengths} tone="good" />
              <Points title="What it costs you" items={analysis?.tradeoffs} tone="bad" />
            </div>
          </section>

          {comparison && (
            <Section title="Against your best match">
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm tabular">
                {comparison.metrics.map((m) => (
                  <span key={m.label} className="flex items-center gap-1">
                    <span className="text-muted-foreground">{m.label}</span>
                    {m.from}
                    <ArrowRightIcon className="size-3 text-muted-foreground" />
                    <span
                      className={cn(
                        "font-semibold",
                        m.better === true && "text-[color:var(--better)]",
                        m.better === false && "text-[color:var(--worse)]",
                      )}
                    >
                      {m.to}
                    </span>
                  </span>
                ))}
                <span className="text-muted-foreground">
                  {comparison.changes.length} of {comparison.unitCount} sections differ
                </span>
              </div>
            </Section>
          )}

          <Section title="Your week" note={`${totalHours} hours on campus, ${totalGaps} of them waiting`}>
            <Table
              head={["Day", "First class", "Last class", "On campus", "Classes", "Waiting"]}
              rows={week.map((d) => [
                DAY_LABEL[d.day],
                formatTime(d.firstStart),
                formatTime(d.lastEnd),
                `${d.hoursOnCampus} h`,
                String(d.classes),
                d.gapHours ? `${d.gapHours} h` : "None",
              ])}
              flag={week.map((d) => d.hoursOnCampus >= 8)}
              flagNote="Long day, 8 hours or more"
            />
          </Section>

          <Section title="Your professors" note="Lectures only. DGDs and labs are usually run by TAs.">
            <Table
              head={["Course", "Professor", "Rating", "Difficulty", "Would take again"]}
              rows={professors.map((p) => [
                p.courseCode,
                p.prof ?? "Not listed yet",
                p.rating != null ? `${p.rating.toFixed(1)} / 5` : "No ratings",
                p.difficulty != null ? `${p.difficulty.toFixed(1)} / 5` : "",
                p.wouldTakeAgain != null ? `${p.wouldTakeAgain}%` : "",
              ])}
              flag={professors.map((p) => p.rating != null && p.rating < 3)}
              flagNote="Rated below 3 out of 5"
            />
          </Section>

          {checks.length > 0 && (
            <Section title="Your preferences">
              <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
                {checks.map((c) => (
                  <li key={c.label} className="flex items-start gap-2">
                    {c.kept ? (
                      <CheckIcon className="mt-0.5 size-4 shrink-0 text-[color:var(--better)]" />
                    ) : (
                      <XIcon className="mt-0.5 size-4 shrink-0 text-[color:var(--worse)]" />
                    )}
                    <span>
                      <span className="font-medium">{c.label}</span>
                      <span className="text-muted-foreground">. {c.detail}.</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <SparklesIcon className="size-3.5" />
            The summary and the two lists are written by AI from these numbers. Everything else is calculated directly.
          </p>
        </ScrollPanel>
      </DialogContent>
    </Dialog>
  )
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold">
        {title}
        {note && <span className="font-normal text-muted-foreground">{note}</span>}
      </h3>
      {children}
    </section>
  )
}

function Points({ title, items, tone }: { title: string; items: string[] | undefined; tone: "good" | "bad" }) {
  const Icon = tone === "good" ? CheckIcon : CircleAlertIcon
  return (
    <div className="grid content-start gap-2 rounded-lg border bg-muted/40 p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {!items ? (
        <Skeleton className="h-10 w-full" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tone === "good" ? "Nothing stands out." : "Nothing you give up."}</p>
      ) : (
        <ul className="grid gap-1.5 text-sm">
          {items.map((t) => (
            <li key={t} className="flex items-start gap-2">
              <Icon
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  tone === "good" ? "text-[color:var(--better)]" : "text-[color:var(--worse)]",
                )}
              />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Table({ head, rows, flag, flagNote }: { head: string[]; rows: string[][]; flag: boolean[]; flagNote: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm tabular">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              {r.map((cell, j) => (
                <td key={j} className={cn("px-3 py-1.5 whitespace-nowrap", j === 0 && "font-medium")}>
                  {j === 0 && flag[i] ? (
                    <span className="flex items-center gap-1.5" title={flagNote}>
                      {cell}
                      <CircleAlertIcon className="size-3.5 text-[color:var(--worse)]" aria-label={flagNote} />
                    </span>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
