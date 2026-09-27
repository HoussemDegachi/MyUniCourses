import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { GRID_MAX_HOUR, GRID_MIN_HOUR } from "@/config"
import { courseColorVar } from "@/lib/colors"
import { ALL_DAYS, DAY_LABEL, DAY_SHORT, formatRange, formatTime, fromMinutes, toMinutes } from "@/lib/time"
import { cn } from "@/lib/utils"
import type { BusyBlock, Prof, Section } from "@/types"
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
  changed?: Set<string> // section ids that differ from the best match
  focusChanged?: boolean // fade everything that didn't change
  buildId: number // goes up on every rebuild, so a new week is drawn fresh
}

// Where a block lives, independent of which section fills it. A block whose slot
// was already on screen glides there; one in a new slot gets drawn in.
const slotOf = (s: Section, day: string) => `${s.courseCode}-${s.type}-${day}`

const STROKE_GAP_MS = 45
const MAX_DELAY_MS = 900

// The grid fills whatever height it is given, so nothing scrolls. It does that by
// positioning blocks as percentages of the day, and by only showing the hours that
// actually contain something (rounded out to the hour, with a little air).
export function WeekGrid({
  sections,
  busy,
  courseOrder,
  conflicts,
  profs,
  onLoadProf,
  onSwap,
  dimmed,
  changed,
  focusChanged,
  buildId,
}: Props) {
  // Always the full week: uOttawa does schedule Saturday and Sunday sections.
  const days = ALL_DAYS

  // Hovering one class lights up every meeting of that course across the week.
  const [focusCourse, setFocusCourse] = useState<string | null>(null)

  // Slots shown before this change. Updated during render (React's pattern for
  // "state from the previous render"), keyed on content so a fresh [] isn't a change.
  const signature = sections.map((s) => s.id).join()
  const slots = sections.flatMap((s) => s.days.map((d) => slotOf(s, d)))
  const [seen, setSeen] = useState({
    signature,
    buildId,
    slots,
    before: new Set<string>(),
  })
  if (seen.signature !== signature || seen.buildId !== buildId) {
    // A rebuild starts from a blank page; a tab switch or swap remembers what was there.
    setSeen({
      signature,
      buildId,
      slots,
      before: seen.buildId !== buildId ? new Set() : new Set(seen.slots),
    })
  }
  const freshWeek = seen.before.size === 0

  // Strokes go Monday to Sunday, earliest class first.
  const drawOrder = useMemo(() => {
    const keys = days.flatMap((d) =>
      sections
        .filter((s) => s.days.includes(d))
        .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
        .map((s) => `${s.id}-${d}`),
    )
    return new Map(keys.map((k, i) => [k, i]))
  }, [sections, days])

  const { firstHour, lastHour } = useMemo(() => {
    const times = [
      ...sections.flatMap((s) => [toMinutes(s.start), toMinutes(s.end)]),
      ...busy.flatMap((b) => [toMinutes(b.start), toMinutes(b.end)]),
    ]

    const start = times.length ? Math.floor(Math.min(...times) / 60) - 1 : 8
    const end = times.length ? Math.ceil(Math.max(...times) / 60) + 1 : 18

    return {
      firstHour: Math.max(GRID_MIN_HOUR, Math.min(start, 9)),
      lastHour: Math.min(GRID_MAX_HOUR, Math.max(end, 17)),
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
        style={{
          gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))`,
        }}
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
        style={{
          gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))`,
        }}
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
                    "busy-hatch absolute inset-x-1 overflow-hidden rounded-sm px-1.5 py-0.5 text-[11px] leading-tight text-muted-foreground transition-opacity duration-200",
                    conflicts.has(b.id) && "ring-2 ring-destructive",
                    focusCourse && "opacity-50",
                  )}
                  style={{
                    top: `${top(b.start)}%`,
                    height: `${height(b.start, b.end)}%`,
                  }}
                  title={`${b.title}, ${formatRange(b.start, b.end)}`}
                >
                  <p className="truncate font-medium">{b.title}</p>
                </div>
              ))}

            <AnimatePresence initial={false}>
              {sections
                .filter((s) => s.days.includes(day))
                .map((s) => {
                  // The build number is part of the key and layout id, so a rebuild
                  // always redraws, and old blocks fading out never glide into new ones.
                  const key = `${buildId}-${s.id}-${day}`
                  const lifted = focusCourse === s.courseCode
                  const faded = focusCourse ? !lifted : Boolean(focusChanged && !changed?.has(s.id))
                  return (
                    <motion.div
                      key={key}
                      layout
                      layoutId={`${buildId}-${slotOf(s, day)}`}
                      initial={false}
                      animate={{
                        opacity: faded ? 0.3 : 1,
                        y: lifted ? -2 : 0,
                      }}
                      exit={{
                        opacity: 0,
                        scale: 0.94,
                        transition: { duration: 0.18 },
                      }}
                      transition={{
                        layout: {
                          type: "spring",
                          stiffness: 420,
                          damping: 36,
                        },
                        y: { type: "spring", stiffness: 500, damping: 30 },
                        opacity: { duration: 0.2 },
                      }}
                      className={cn(
                        "absolute inset-x-1 rounded-[5px] transition-shadow duration-200",
                        lifted ? "z-20 shadow-lg shadow-black/15" : "z-10",
                      )}
                      style={{
                        top: `${top(s.start)}%`,
                        height: `${height(s.start, s.end)}%`,
                      }}
                    >
                      <ClassBlock
                        section={s}
                        day={day}
                        color={courseColorVar(s.courseCode, courseOrder)}
                        conflicted={conflicts.has(s.id)}
                        changed={changed?.has(s.id) ?? false}
                        draw={!seen.before.has(slotOf(s, day))}
                        drawDelay={
                          freshWeek ? Math.min((drawOrder.get(`${s.id}-${day}`) ?? 0) * STROKE_GAP_MS, MAX_DELAY_MS) : 0
                        }
                        onHoverCourse={setFocusCourse}
                        prof={s.prof ? profs[s.prof] : null}
                        onLoadProf={onLoadProf}
                        onSwap={onSwap}
                      />
                    </motion.div>
                  )
                })}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  )
}
