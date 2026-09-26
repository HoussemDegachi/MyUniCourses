import { useMemo } from "react"
import { motion } from "motion/react"
import { GRID_MAX_HOUR, GRID_MIN_HOUR } from "@/config"
import { courseColorVar } from "@/lib/colors"
import { DAY_LABEL, DAY_SHORT, WEEKDAYS, formatRange, formatTime, fromMinutes, toMinutes } from "@/lib/time"
import { cn } from "@/lib/utils"
import type { BusyBlock, Day, Prof, Section } from "@/types"
import { ClassBlock } from "@/components/schedule/ClassBlock"

interface Props {
  sections: Section[]
  busy: BusyBlock[]
  courseOrder: string[]
  conflicts: Set<string>
  profs: Record<string, Prof | null>
  onLoadProf: (name: string) => void
  onSwap?: (unitKey: string) => void
  dimmed?: boolean
}

// The grid fills whatever height it is given, so nothing scrolls. It does that by
// positioning blocks as percentages of the day, and by only showing the hours that
// actually contain something (rounded out to the hour, with a little air).
export function WeekGrid({ sections, busy, courseOrder, conflicts, profs, onLoadProf, onSwap, dimmed }: Props) {
  const { firstHour, lastHour, days } = useMemo(() => {
    const times = [
      ...sections.flatMap((s) => [toMinutes(s.start), toMinutes(s.end)]),
      ...busy.flatMap((b) => [toMinutes(b.start), toMinutes(b.end)]),
    ]

    const start = times.length ? Math.floor(Math.min(...times) / 60) - 1 : 8
    const end = times.length ? Math.ceil(Math.max(...times) / 60) + 1 : 18

    const needsSat = sections.some((s) => s.days.includes("SAT")) || busy.some((b) => b.day === "SAT")

    return {
      firstHour: Math.max(GRID_MIN_HOUR, Math.min(start, 9)),
      lastHour: Math.min(GRID_MAX_HOUR, Math.max(end, 17)),
      days: (needsSat ? [...WEEKDAYS, "SAT"] : WEEKDAYS) as Day[],
    }
  }, [sections, busy])

  const dayStart = firstHour * 60
  const dayLength = (lastHour - firstHour) * 60
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i)

  const top = (t: string) => ((toMinutes(t) - dayStart) / dayLength) * 100
  const height = (a: string, b: string) => ((toMinutes(b) - toMinutes(a)) / dayLength) * 100

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card transition-opacity",
        dimmed && "opacity-40",
      )}
    >
      {/* Day names */}
      <div
        className="grid shrink-0 border-b"
        style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <div />
        {days.map((d) => (
          <div key={d} className="border-l px-2 py-2 text-[13px] font-semibold">
            <span className="hidden md:inline">{DAY_LABEL[d]}</span>
            <span className="md:hidden">{DAY_SHORT[d]}</span>
          </div>
        ))}
      </div>

      {/* Columns. This row takes all remaining height, so the day fills the panel. */}
      <div
        className="grid min-h-0 flex-1"
        style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}
        role="table"
        aria-label="Weekly schedule"
      >
        <div className="relative overflow-hidden">
          {hours.map((h, i) => (
            <span
              key={h}
              className={cn(
                "absolute right-2 text-[11px] text-muted-foreground tabular",
                // The first label would be cut in half by the top edge.
                i === 0 ? "translate-y-0.5" : "-translate-y-1/2",
              )}
              style={{ top: `${(i / hours.length) * 100}%` }}
            >
              {formatTime(fromMinutes(h * 60))}
            </span>
          ))}
        </div>

        {days.map((day) => (
          <div
            key={day}
            role="cell"
            aria-label={DAY_LABEL[day]}
            className="relative border-l"
            // One solid line per hour, one faint line on the half hour.
            style={{
              backgroundImage:
                "linear-gradient(to bottom, var(--grid-line-strong) 0 1px, transparent 1px calc(50% - 1px), var(--grid-line) calc(50% - 1px) 50%, transparent 50%)",
              backgroundSize: `100% ${100 / hours.length}%`,
            }}
          >
            {busy
              .filter((b) => b.day === day)
              .map((b) => (
                <div
                  key={b.id}
                  className={cn(
                    "busy-hatch absolute inset-x-1 overflow-hidden rounded-sm px-1.5 py-0.5 text-[11px] leading-tight text-muted-foreground",
                    conflicts.has(b.id) && "ring-2 ring-destructive",
                  )}
                  style={{ top: `${top(b.start)}%`, height: `${height(b.start, b.end)}%` }}
                  title={`${b.title}, ${formatRange(b.start, b.end)}`}
                >
                  <p className="truncate font-medium">{b.title}</p>
                </div>
              ))}

            {sections
              .filter((s) => s.days.includes(day))
              .map((s) => (
                <motion.div
                  key={`${s.id}-${day}`}
                  layout
                  layoutId={`${s.courseCode}-${s.type}-${day}`}
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                  className="absolute inset-x-1 z-10"
                  style={{ top: `${top(s.start)}%`, height: `${height(s.start, s.end)}%` }}
                >
                  <ClassBlock
                    section={s}
                    day={day}
                    color={courseColorVar(s.courseCode, courseOrder)}
                    conflicted={conflicts.has(s.id)}
                    prof={s.prof ? profs[s.prof] : null}
                    onLoadProf={onLoadProf}
                    onSwap={onSwap}
                  />
                </motion.div>
              ))}
          </div>
        ))}
      </div>
    </div>
  )
}
