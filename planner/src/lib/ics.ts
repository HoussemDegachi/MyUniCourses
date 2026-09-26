import ICAL from "ical.js"
import type { BusyBlock, Day, Section, Term } from "@/types"
import { fromMinutes } from "@/lib/time"

// ---------- Import ----------

const ICAL_DAY: Record<string, Day | undefined> = {
  SU: "SUN",
  MO: "MON",
  TU: "TUE",
  WE: "WED",
  TH: "THU",
  FR: "FRI",
  SA: "SAT",
}
// ical.js dayOfWeek(): 1 is Sunday, 2 is Monday, and so on.
const JS_DAY: (Day | undefined)[] = [undefined, "SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]

export interface ImportResult {
  blocks: BusyBlock[]
  skipped: number // one-off events that aren't weekly
}

// Only weekly recurring events become busy blocks (shifts, practices, club meetings).
// A one-off dentist appointment shouldn't block every week of the term.
export function parseIcs(text: string): ImportResult {
  const root = new ICAL.Component(ICAL.parse(text))
  const blocks: BusyBlock[] = []
  let skipped = 0

  for (const ve of root.getAllSubcomponents("vevent")) {
    const event = new ICAL.Event(ve)
    const rrule = ve.getFirstPropertyValue("rrule") as ICAL.Recur | null
    if (!rrule || rrule.freq !== "WEEKLY" || event.startDate.isDate) {
      skipped++
      continue
    }

    const start = event.startDate
    const end = event.endDate
    const startTime = fromMinutes(start.hour * 60 + start.minute)
    const endTime = fromMinutes(Math.min(end.hour * 60 + end.minute, 23 * 60 + 59))

    const byDay = (rrule.parts.BYDAY as string[] | undefined) ?? []
    const days = byDay.length
      ? byDay.map((d) => ICAL_DAY[d.slice(-2)]).filter((d): d is Day => !!d)
      : [JS_DAY[start.dayOfWeek()]].filter((d): d is Day => !!d)

    for (const day of days) {
      blocks.push({
        id: `busy-${blocks.length}-${day}`,
        title: event.summary || "Busy",
        day,
        start: startTime,
        end: endTime,
      })
    }
  }
  return { blocks, skipped }
}

// ---------- Export ----------

const RFC_DAY: Record<Day, string> = { MON: "MO", TUE: "TU", WED: "WE", THU: "TH", FRI: "FR", SAT: "SA", SUN: "SU" }
const JS_INDEX: Record<Day, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 }

// Ottawa time zone, so imported events land at the right hour in any calendar app.
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:America/Toronto",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0400",
  "TZNAME:EDT",
  "DTSTART:19700308T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0400",
  "TZOFFSETTO:-0500",
  "TZNAME:EST",
  "DTSTART:19701101T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
]

export function buildIcs(sections: Section[], term: Term, calendarName: string): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${calendarName}//Schedule//EN`,
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeText(`${calendarName} ${term.name}`)}`,
    ...VTIMEZONE,
  ]
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
  const until = term.endDate.replace(/-/g, "") + "T235959Z"

  for (const s of sections) {
    const first = firstMeetingDate(term.startDate, s.days)
    lines.push(
      "BEGIN:VEVENT",
      `UID:${s.id}-${term.id}@schedule`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=America/Toronto:${first}T${s.start.replace(":", "")}00`,
      `DTEND;TZID=America/Toronto:${first}T${s.end.replace(":", "")}00`,
      `RRULE:FREQ=WEEKLY;BYDAY=${s.days.map((d) => RFC_DAY[d]).join(",")};UNTIL=${until}`,
      ...exdates(s, term),
      `SUMMARY:${escapeText(`${s.courseCode} ${s.type}`)}`,
      ...(s.location ? [`LOCATION:${escapeText(s.location)}`] : []),
      ...(s.prof ? [`DESCRIPTION:${escapeText(`Prof: ${s.prof}`)}`] : []),
      "END:VEVENT",
    )
  }
  lines.push("END:VCALENDAR")
  return lines.map(fold).join("\r\n") + "\r\n"
}

// Reading week and holidays. EXDATE must match the start time of the occurrence
// it cancels, so each class gets its own list.
function exdates(s: Section, term: Term): string[] {
  const time = `T${s.start.replace(":", "")}00`
  const dates = (term.noClassDates ?? []).filter((d) => s.days.includes(dayOf(d))).map((d) => d.replace(/-/g, "") + time)
  return dates.length ? [`EXDATE;TZID=America/Toronto:${dates.join(",")}`] : []
}

const DAY_BY_INDEX: (Day | undefined)[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
function dayOf(isoDate: string): Day {
  const [y, m, d] = isoDate.split("-").map(Number)
  return DAY_BY_INDEX[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] as Day
}

// The first date on or after the term start that falls on one of the section's days.
function firstMeetingDate(termStart: string, days: Day[]): string {
  const [y, m, d] = termStart.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  const wanted = new Set(days.map((day) => JS_INDEX[day]))
  for (let i = 0; i < 7 && !wanted.has(date.getDay()); i++) date.setDate(date.getDate() + 1)
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n")
}

// Lines over 75 characters must be folded per RFC 5545.
function fold(line: string): string {
  if (line.length <= 75) return line
  const parts = [line.slice(0, 75)]
  for (let i = 75; i < line.length; i += 74) parts.push(" " + line.slice(i, i + 74))
  return parts.join("\r\n")
}

export function downloadFile(filename: string, content: string, type = "text/calendar") {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
