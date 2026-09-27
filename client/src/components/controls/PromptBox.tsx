import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface Props {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void // builds the schedules; Ctrl+Enter does it from the box
  available: boolean // false when the server has no Gemini key
}

const EXAMPLE = "No classes before 10, Fridays off if possible, and good profs matter more to me than times."

// What the student types goes straight to Gemini with the Build button, which picks the
// timetable from it along with the sliders below.
export function PromptBox({ value, onChange, onSubmit, available }: Props) {
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
        {available && <span className="text-xs text-muted-foreground"></span>}
      </div>
    </div>
  )
}
