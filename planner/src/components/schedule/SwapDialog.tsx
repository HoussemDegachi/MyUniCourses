import { ArrowRightIcon, Loader2Icon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DAY_SHORT, formatRange } from "@/lib/time"
import type { Alternative, Section } from "@/types"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  unitKey: string | null
  current: Section[]
  options: Alternative[] | null // null means still loading
  onPick: (option: Alternative) => void
}

const TYPE_LABEL: Record<string, string> = { LEC: "lecture", DGD: "DGD", LAB: "lab", TUT: "tutorial", SEM: "seminar" }

export function SwapDialog({ open, onOpenChange, unitKey, current, options, onPick }: Props) {
  const first = current[0]
  const label = first ? (TYPE_LABEL[first.type] ?? "component") : "component"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Pick a different {label} for {first?.courseCode}
          </DialogTitle>
          <DialogDescription>
            Only times that still fit the rest of your week are shown. Your lecture and everything else stay as they are.
          </DialogDescription>
        </DialogHeader>

        {first && (
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="text-xs font-medium text-muted-foreground">Currently taking</p>
            <p className="mt-0.5 text-sm tabular">
              Section {first.sectionCode}, {times(current)}
            </p>
          </div>
        )}

        {options === null ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Finding other times
          </div>
        ) : options.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No other {label} time fits around the rest of this schedule.
          </p>
        ) : (
          <ul className="grid gap-2">
            {options.map((option) => (
              <li key={option.key}>
                <button
                  type="button"
                  onClick={() => onPick(option)}
                  disabled={!unitKey}
                  className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium tabular">
                      Section {option.sectionCode}
                      {option.status === "WAITLIST" && (
                        <Badge variant="secondary" className="ml-2 font-normal">
                          Waitlist
                        </Badge>
                      )}
                    </p>
                    <p className="truncate text-sm text-muted-foreground tabular">{times(option.sections)}</p>
                  </div>
                  <span className={delta(option.delta)}>
                    {option.delta > 0 ? `+${option.delta}` : option.delta === 0 ? "same" : option.delta}
                  </span>
                  <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function times(sections: Section[]): string {
  return sections
    .map((s) => `${s.days.map((d) => DAY_SHORT[d]).join(" and ")} ${formatRange(s.start, s.end)}`)
    .join(", ")
}

function delta(n: number): string {
  const base = "shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold tabular"
  if (n > 0) return `${base} bg-primary/10 text-primary`
  if (n < 0) return `${base} bg-muted text-muted-foreground`
  return `${base} text-muted-foreground`
}
