import { SparklesIcon, SplitIcon } from "lucide-react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"
import type { Schedule } from "@/types"

interface Props {
  schedules: Schedule[]
  activeId: string
  onChange: (id: string) => void
}

export function ScheduleTabs({ schedules, activeId, onChange }: Props) {
  if (schedules.length === 0) return null
  return (
    <div role="tablist" aria-label="Schedule options" className="flex flex-wrap gap-2">
      {schedules.map((s, i) => {
        const active = s.id === activeId
        const Icon = i === 0 ? SparklesIcon : SplitIcon
        return (
          <button
            key={s.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(s.id)}
            className={cn(
              "relative flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm font-medium transition-colors",
              "outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
              active ? "border-primary/60 text-foreground" : "text-muted-foreground hover:border-input hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="schedule-tab-active"
                className="absolute inset-0 rounded-[inherit] bg-primary/10"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <Icon className={cn("relative size-4", active && "text-primary")} />
            <span className="relative">{i === 0 ? "Best match" : "Alternative"}</span>
            <span className="relative rounded-sm bg-muted px-1 text-xs text-muted-foreground tabular">{s.score}</span>
          </button>
        )
      })}
    </div>
  )
}
