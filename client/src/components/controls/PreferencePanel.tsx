import { useEffect, useRef, useState } from "react"
import { animate } from "motion/react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ALL_DAYS, DAY_SHORT, formatTime } from "@/lib/time"
import type { ChosenStatus, Day, Preferences, Weights } from "@/types"

interface Props {
  value: Preferences
  onChange: (p: Preferences) => void
  animateKey: number // changes after the AI fills in preferences
}

const WEIGHT_LABELS: { key: keyof Weights; label: string; hint: string }[] = [
  { key: "prof", label: "Good profs", hint: "Higher-rated profs" },
  { key: "time", label: "Class times", hint: "Respect your start, end and days off" },
  { key: "gaps", label: "Fewer gaps", hint: "Classes closer together" },
]

const START_OPTIONS = ["08:00", "08:30", "09:00", "10:00", "11:00", "12:00"]
const END_OPTIONS = ["14:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"]
const ANY = "any"

export function PreferencePanel({ value, onChange, animateKey }: Props) {
  const shown = useAnimatedWeights(value.weights, animateKey)

  const setWeight = (key: keyof Weights, n: number) =>
    onChange({ ...value, weights: { ...value.weights, [key]: n } })

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="grid grid-cols-1 gap-4">
        {WEIGHT_LABELS.map(({ key, label, hint }) => (
          <div key={key} className="grid grid-cols-1 gap-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor={`w-${key}`}>{label}</Label>
              <span className="text-xs text-muted-foreground tabular">{Math.round(shown[key])}</span>
            </div>
            <Slider
              id={`w-${key}`}
              min={0}
              max={100}
              step={5}
              value={[shown[key]]}
              onValueChange={([n]) => setWeight(key, n)}
              aria-describedby={`w-${key}-hint`}
            />
            <p id={`w-${key}-hint`} className="sr-only">
              {hint}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TimeSelect
          id="earliest"
          label="Start no earlier than"
          value={value.earliestStart}
          options={START_OPTIONS}
          onChange={(t) => onChange({ ...value, earliestStart: t })}
        />
        <TimeSelect
          id="latest"
          label="Finish by"
          value={value.latestEnd}
          options={END_OPTIONS}
          onChange={(t) => onChange({ ...value, latestEnd: t })}
        />
      </div>

      <div className="grid grid-cols-1 gap-2">
        <Label>Days off</Label>
        <ToggleGroup
          type="multiple"
          variant="outline"
          className="w-full bg-card"
          value={value.daysOff}
          onValueChange={(days) => onChange({ ...value, daysOff: days as Day[] })}
        >
          {ALL_DAYS.map((d) => (
            <ToggleGroupItem key={d} value={d} className="min-w-0 flex-1 px-0 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              {DAY_SHORT[d]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <Label>Sections to consider</Label>
        <ToggleGroup
          type="multiple"
          variant="outline"
          className="w-full bg-card"
          value={value.allowedStatus}
          onValueChange={(s) => s.length > 0 && onChange({ ...value, allowedStatus: s as ChosenStatus[] })}
        >
          <ToggleGroupItem value="OPEN" className="flex-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            Open
          </ToggleGroupItem>
          <ToggleGroupItem value="WAITLIST" className="flex-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            Waitlist
          </ToggleGroupItem>
        </ToggleGroup>
        <p className="text-xs text-muted-foreground">
          {/* Full sections are never suggested. uoCampus doesn't publish waitlist length, so we can't show how long the line is. */}
        </p>
      </div>
    </div>
  )
}

function TimeSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  value: string | null
  options: string[]
  onChange: (t: string | null) => void
}) {
  const all = value && !options.includes(value) ? [...options, value].sort() : options
  return (
    <div className="grid grid-cols-1 gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value ?? ANY} onValueChange={(v) => onChange(v === ANY ? null : v)}>
        <SelectTrigger id={id} className="w-full bg-card">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any time</SelectItem>
          {all.map((t) => (
            <SelectItem key={t} value={t}>
              {formatTime(t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// When the AI fills in weights, glide the sliders to their new values so people see what changed.
// When the user drags a slider, follow it instantly.
function useAnimatedWeights(target: Weights, animateKey: number): Weights {
  const [shown, setShown] = useState(target)
  const lastKey = useRef(animateKey)
  const shownRef = useRef(shown)
  shownRef.current = shown

  useEffect(() => {
    if (animateKey === lastKey.current) {
      setShown(target)
      return
    }
    lastKey.current = animateKey
    const from = shownRef.current
    const controls = animate(0, 1, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (t) =>
        setShown({
          prof: from.prof + (target.prof - from.prof) * t,
          time: from.time + (target.time - from.time) * t,
          gaps: from.gaps + (target.gaps - from.gaps) * t,
        }),
    })
    return () => controls.stop()
  }, [target, animateKey])

  return shown
}
