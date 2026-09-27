import { ArrowRightIcon, EyeIcon } from "lucide-react"
import { motion } from "motion/react"
import { Toggle } from "@/components/ui/toggle"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { Comparison } from "@/lib/compare"
import { cn } from "@/lib/utils"

const TYPE_LABEL: Record<string, string> = { LEC: "lecture", DGD: "DGD", LAB: "lab", TUT: "tutorial", SEM: "seminar" }

interface Props {
  comparison: Comparison
  highlight: boolean
  onHighlightChange: (on: boolean) => void
}

// Shown on the Alternative tab: what you gain and give up against the best match.
export function CompareBar({ comparison, highlight, onHighlightChange }: Props) {
  const { metrics, changes, unitCount } = comparison

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm"
      aria-label="Compared with your best match"
    >
      <span className="text-muted-foreground">vs best match</span>

      {metrics.map((m) => (
        <span key={m.label} className="flex items-center gap-1 tabular">
          <span className="text-muted-foreground">{m.label}</span>
          <span>{m.from}</span>
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

      <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="cursor-default rounded-sm underline decoration-dotted underline-offset-4 outline-none tabular focus-visible:ring-2 focus-visible:ring-ring">
            {changes.length} of {unitCount} sections differ
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <ul className="grid gap-0.5">
            {changes.map((c) => (
              <li key={`${c.courseCode}-${c.type}`}>
                {c.courseCode} {TYPE_LABEL[c.type] ?? c.type}: {c.from ? `${c.from} to ${c.to}` : c.to}
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
      </TooltipProvider>

      <Toggle
        size="sm"
        variant="outline"
        pressed={highlight}
        onPressedChange={onHighlightChange}
        className="ml-auto h-7"
        aria-label="Highlight the classes that changed"
      >
        <EyeIcon />
        Show changes
      </Toggle>
    </motion.div>
  )
}
