import { useEffect, useRef, useState } from "react"
import { RepeatIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Skeleton } from "@/components/ui/skeleton"
import { DAY_LABEL, DAY_SHORT, formatRange, toMinutes } from "@/lib/time"
import { cn } from "@/lib/utils"
import type { Day, Prof, Section } from "@/types"

interface Props {
  section: Section
  day: Day
  color: string
  conflicted: boolean
  changed: boolean
  draw: boolean // play the highlighter stroke when this block first appears
  drawDelay: number // ms, so a fresh week fills in one stroke after another
  onHoverCourse: (courseCode: string | null) => void
  prof: Prof | null | undefined // undefined means still loading
  onLoadProf: (name: string) => void
  onSwap?: (unitKey: string) => void
}

function compactRange(start: string, end: string): string {
  const clock = (t: string) => {
    const m = toMinutes(t)
    const h = Math.floor(m / 60) % 12 || 12
    return `${h}:${String(m % 60).padStart(2, "0")}`
  }
  return `${clock(start)}–${clock(end)}`
}

const TYPE_LABEL: Record<string, string> = {
  LEC: "Lecture",
  DGD: "DGD",
  LAB: "Lab",
  TUT: "Tutorial",
  SEM: "Seminar",
}

export function ClassBlock({
  section,
  day,
  color,
  conflicted,
  changed,
  draw,
  drawDelay,
  onHoverCourse,
  prof,
  onLoadProf,
  onSwap,
}: Props) {
  const ref = useRef<HTMLButtonElement>(null)
  const [size, setSize] = useState({ h: 0, w: 0 })

  // Blocks shrink as the grid gets denser, so what fits inside is measured, not guessed.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) =>
      setSize({ h: entry.contentRect.height, w: entry.contentRect.width }),
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Heights are the content box (padding excluded). One line of code and type is
  // about 15px and the time line about 13px, so the time fits from 27px up.
  const showTime = size.h >= 27
  const showRoom = size.h >= 40 && size.w >= 90
  // Narrow blocks drop AM/PM: "8:30-9:50" instead of "8:30 AM to 9:50 AM".
  const time = size.w >= 118 ? formatRange(section.start, section.end) : compactRange(section.start, section.end)

  return (
    <HoverCard
      openDelay={120}
      closeDelay={80}
      onOpenChange={(open) => open && section.prof && onLoadProf(section.prof)}
    >
      <HoverCardTrigger asChild>
        <button
          ref={ref}
          type="button"
          className={cn(
            "ink h-full w-full overflow-hidden px-1.5 py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
            draw && "ink-draw",
          )}
          data-type={section.type}
          data-waitlist={section.status === "WAITLIST" || undefined}
          data-conflict={conflicted || undefined}
          style={{
            ["--hl" as string]: color,
            ["--draw-delay" as string]: `${drawDelay}ms`,
          }}
          onMouseEnter={() => onHoverCourse(section.courseCode)}
          onMouseLeave={() => onHoverCourse(null)}
          onFocus={() => onHoverCourse(section.courseCode)}
          onBlur={() => onHoverCourse(null)}
          aria-label={`${section.courseCode} ${TYPE_LABEL[section.type] ?? section.type}, ${DAY_LABEL[day]} ${formatRange(section.start, section.end)}${section.prof ? `, ${section.prof}` : ""}${changed ? ", differs from your best match" : ""}`}
        >
          {changed && (
            <span aria-hidden className="absolute right-1 bottom-1 size-1.5 rounded-full bg-current opacity-80" />
          )}
          {/* Positioned so the text sits above the texture layer. */}
          <span className="relative flex items-baseline gap-1 text-[12px] leading-tight font-bold">
            <span className="truncate">{section.courseCode}</span>
            <span className="shrink-0 text-[10px] font-medium opacity-70">{section.type}</span>
            {section.status === "WAITLIST" && (
              <span className="ml-auto shrink-0 text-[9px] font-bold opacity-80">WL</span>
            )}
          </span>
          {showTime && (
            <span className="relative block text-[10px] leading-tight opacity-80 tabular">
              {time}
            </span>
          )}
          {showRoom && section.location && (
            <span className="relative block truncate text-[10px] leading-tight opacity-70">{section.location}</span>
          )}
        </button>
      </HoverCardTrigger>

      <HoverCardContent className="w-80" side="right" align="start">
        <div className="grid gap-3">
          <div>
            <p className="font-semibold">
              {section.courseCode} {TYPE_LABEL[section.type] ?? section.type}
            </p>
            <p className="text-sm text-muted-foreground tabular">
              {section.days.map((d) => DAY_SHORT[d]).join(" and ")}, {formatRange(section.start, section.end)}
              {section.location ? `, ${section.location}` : ""}
            </p>
            <div className="mt-1.5 flex items-center gap-1.5">
              <Badge variant="outline" className="font-normal">
                Section {section.sectionCode}
              </Badge>
              {section.status === "WAITLIST" && <Badge variant="secondary">Waitlist</Badge>}
            </div>
          </div>

          {!section.prof ? (
            <p className="text-sm text-muted-foreground">No instructor listed. DGDs and labs are usually run by TAs.</p>
          ) : prof === undefined ? (
            <div className="grid gap-2 border-t pt-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : prof === null || prof.rating === null ? (
            <p className="border-t pt-3 text-sm text-muted-foreground">No ratings found for {section.prof}.</p>
          ) : (
            <div className="grid gap-2 border-t pt-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-medium">{section.prof}</p>
                <p className="text-2xl font-bold tabular">
                  {prof.rating.toFixed(1)}
                  <span className="text-sm font-normal text-muted-foreground"> / 5</span>
                </p>
              </div>
              <p className="text-xs text-muted-foreground tabular">
                Difficulty {prof.difficulty?.toFixed(1) ?? "unknown"}
                {prof.wouldTakeAgain != null ? `, ${prof.wouldTakeAgain}% would take again` : ""}, {prof.numRatings}{" "}
                ratings
              </p>
              {prof.summary && <p className="text-sm leading-relaxed">{prof.summary}</p>}
              {prof.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {prof.tags.map((t) => (
                    <Badge key={t} variant="outline" className="font-normal">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">Written by AI from Rate My Professors reviews.</p>
            </div>
          )}

          {/* A group has only one lecture, so changing lecture means a different
              schedule altogether. That's what the option tabs are for. */}
          {onSwap && section.type !== "LEC" && (
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => onSwap(`${section.courseCode}|${section.sectionCode}`)}
            >
              <RepeatIcon />
              Other times for this {TYPE_LABEL[section.type]?.toLowerCase() ?? "component"}
            </Button>
          )}

          {onSwap && section.type === "LEC" && (
            <p className="border-t pt-3 text-xs text-muted-foreground">
              Want a different lecture? Check the other options along the top. Labs and DGDs can be swapped on their
              own.
            </p>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
