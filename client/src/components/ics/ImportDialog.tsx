import { useRef, useState } from "react"
import { UploadIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { parseIcs, type ImportResult } from "@/lib/ics"

interface Props {
  onImport: (result: ImportResult) => void
}

export function ImportDialog({ onImport }: Props) {
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    let result: ImportResult
    try {
      result = parseIcs(await file.text())
    } catch {
      toast.error("That file isn't a valid calendar. Export it as .ics from Google Calendar, Outlook or Apple Calendar.")
      return
    }
    if (result.blocks.length === 0 && result.courseCodes.length === 0) {
      toast.error("No classes or weekly events found in that file. One-time events, like an appointment, aren't imported.")
      return
    }
    // The planner says what it added, since only it knows which courses exist this term.
    setOpen(false)
    onImport(result)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UploadIcon />
          Import calendar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import your calendar</DialogTitle>
          <DialogDescription>
            Add an .ics file. Classes in it go into your course list. Weekly events like work shifts, practices or club meetings become busy times, and your schedules are built around them.
          </DialogDescription>
        </DialogHeader>

        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            handleFile(e.dataTransfer.files[0])
          }}
          className={`grid place-items-center gap-2 rounded-lg border-2 border-dashed p-8 text-sm transition-colors ${
            dragging ? "border-primary bg-primary/5" : "hover:bg-muted/50"
          }`}
        >
          <UploadIcon className="size-5 text-muted-foreground" />
          <span className="font-medium">Drop an .ics file here, or click to choose one</span>
        </button>
        <input
          ref={input}
          type="file"
          accept=".ics,text/calendar"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0])
            e.target.value = ""
          }}
        />

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
