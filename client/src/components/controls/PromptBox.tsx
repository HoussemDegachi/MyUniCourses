import { Loader2Icon, WandSparklesIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DAY_LABEL, formatTime } from "@/lib/time"
import type { Preferences } from "@/types"

interface Props {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  parsing: boolean
  parseCount: number
  preferences: Preferences
  available: boolean // false when the server has no Gemini key
}

const EXAMPLE = "No classes before 10, Fridays off if possible, and good profs matter more to me than times."

export function PromptBox({ value, onChange, onSubmit, parsing, parseCount, preferences, available }: Props) {
  const understood = summarize(preferences)

  return (
    <div className="grid grid-cols-1 gap-2">
      <Label htmlFor="prompt">What matters to you?</Label>
      <Textarea
        id="prompt"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSubmit()
        }}
        placeholder={available ? EXAMPLE : "The AI isn't set up on this server. Use the sliders below."}
        disabled={!available}
        className="min-h-24 resize-none bg-card"
      />
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
          onClick={() => onChange(EXAMPLE)}
          disabled={!available}
        >
          Use the example
        </button>
        <Button size="sm" variant="secondary" onClick={onSubmit} disabled={parsing || !value.trim() || !available}>
          {parsing ? <Loader2Icon className="animate-spin" /> : <WandSparklesIcon />}
          {parsing ? "Reading" : "Read my preferences"}
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {parseCount > 0 && (understood.length > 0 || preferences.notes.length > 0) && (
          <motion.div
            key={parseCount}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 gap-2 rounded-md border border-dashed p-3"
          >
            <p className="text-sm font-medium">Here's what I understood</p>
            <div className="flex flex-wrap gap-1.5">
              {understood.map((u) => (
                <Badge key={u} variant="secondary" className="font-normal">
                  {u}
                </Badge>
              ))}
            </div>
            {preferences.notes.map((n) => (
              <p key={n} className="text-xs text-muted-foreground">
                {n}
              </p>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function summarize(p: Preferences): string[] {
  const out: string[] = []
  if (p.earliestStart) out.push(`Start at ${formatTime(p.earliestStart)} or later`)
  if (p.latestEnd) out.push(`Done by ${formatTime(p.latestEnd)}`)
  for (const d of p.daysOff) out.push(`${DAY_LABEL[d]}s off`)
  const top = Object.entries(p.weights).sort((a, b) => b[1] - a[1])[0]
  if (top && top[1] >= 70) {
    out.push({ prof: "Good profs matter most", time: "Class times matter most", gaps: "Fewer gaps matter most" }[top[0] as "prof" | "time" | "gaps"])
  }
  if (!p.allowedStatus.includes("WAITLIST")) out.push("No waitlists")
  return out
}
