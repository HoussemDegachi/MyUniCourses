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
import { parseIcs } from "@/lib/ics"
import type { BusyBlock } from "@/types"

interface Props {
  onImport: (blocks: BusyBlock[]) => void
}

export function ImportDialog({ onImport }: Props) {
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const { blocks, skipped } = parseIcs(await file.text())
      if (blocks.length === 0) {
        toast.error("No weekly events found in that file. Only repeating events, like shifts or practices, are imported.")
        return
      }
      onImport(blocks)
      setOpen(false)
      toast.success(
        `Imported ${blocks.length} busy time${blocks.length === 1 ? "" : "s"}.${skipped ? ` Skipped ${skipped} one-time event${skipped === 1 ? "" : "s"}.` : ""}`,
      )
    } catch {
      toast.error("That file isn't a valid calendar. Export it as .ics from Google Calendar, Outlook or Apple Calendar.")
    }
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
            Add your work shifts, practices or club meetings as an .ics file. Weekly events become busy times, and your schedules will be built around them.
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
