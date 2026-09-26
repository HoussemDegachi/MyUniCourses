import { useState } from "react"
import { CalendarPlusIcon, DownloadIcon, Loader2Icon, RotateCcwIcon } from "lucide-react"
import { toast } from "sonner"
import { api, ApiError } from "@/api/client"
import { Button } from "@/components/ui/button"
import { ImportDialog } from "@/components/ics/ImportDialog"
import { APP_NAME } from "@/config"
import { useAccount } from "@/hooks/useAccount"
import { buildIcs, downloadFile } from "@/lib/ics"
import type { BusyBlock, Schedule, Term } from "@/types"

interface Props {
  term: Term | null
  active: Schedule | null
  hasContent: boolean
  googleCalendarReady: boolean
  onImport: (blocks: BusyBlock[]) => void
  onClear: () => void
}

export function CalendarActions({ term, active, hasContent, googleCalendarReady, onImport, onClear }: Props) {
  const account = useAccount()
  const [pushing, setPushing] = useState(false)

  const exportIcs = () => {
    if (!term || !active) return
    downloadFile(`${APP_NAME.toLowerCase()}-${term.id}.ics`, buildIcs(active.sections, term, APP_NAME))
    toast.success("Exported. Open the file to add your classes to your calendar.")
  }

  const pushToGoogle = async () => {
    if (!term || !active) return

    if (!account.isSignedIn) {
      toast("Sign in first so we can add classes to your calendar.", {
        action: { label: "Sign in", onClick: account.signIn },
      })
      return
    }

    setPushing(true)
    try {
      const result = await api.pushToGoogleCalendar(active, term)
      toast.success(`Added ${result.created} classes to a new calendar called "${result.calendarName}".`, {
        description: result.failed.length ? `${result.failed.join(", ")} couldn't be added.` : undefined,
      })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Couldn't reach Google Calendar."
      if (err instanceof ApiError && (err.code === "NO_GOOGLE" || err.code === "GOOGLE_PERMISSION")) {
        toast.error(message, { action: { label: "Sign in again", onClick: account.signIn } })
      } else {
        toast.error(message)
      }
    } finally {
      setPushing(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ImportDialog onImport={onImport} />

      {googleCalendarReady && (
        <Button size="sm" onClick={pushToGoogle} disabled={!active || !term || pushing}>
          {pushing ? <Loader2Icon className="animate-spin" /> : <CalendarPlusIcon />}
          {pushing ? "Adding" : "Add to Google Calendar"}
        </Button>
      )}

      <Button variant="outline" size="sm" onClick={exportIcs} disabled={!active || !term}>
        <DownloadIcon />
        Export .ics
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          onClear()
          toast("Calendar cleared.")
        }}
        disabled={!hasContent}
      >
        <RotateCcwIcon />
        Clear
      </Button>
    </div>
  )
}
