// Shared data shapes. Keep these identical to the backend's JSON.
// If the backend changes a field, change it here first.

export type Day = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT"

export type SectionType = "LEC" | "DGD" | "LAB" | "TUT" | "SEM"

// CLOSED sections exist in the data but are never offered to the student,
// so the UI only ever asks about OPEN and WAITLIST.
export type SectionStatus = "OPEN" | "WAITLIST" | "CLOSED"
export type ChosenStatus = "OPEN" | "WAITLIST"

export interface Term {
  id: number // e.g. "2026-fall"
  name: string // e.g. "Fall 2026"
  startDate: string // ISO date, first day of classes
  endDate: string // ISO date, last day of classes
}

export interface Course {
  code: string // "ITI1120"
  title: string
  credits: number
}

// One meeting pattern of one component (a lecture, a DGD, a lab...).
// A course "group" (A, B, C) bundles components that must be taken together.
export interface Section {
  id: string // "ITI1120-A00-LEC-0"
  courseCode: string
  sectionCode: string // "A00"
  group: string // "A", shared by components you must take together
  type: SectionType
  days: Day[]
  start: string // "08:30" (24h)
  end: string // "09:50"
  prof: string | null
  location: string | null
  status: SectionStatus
}

export interface Weights {
  prof: number // 0 to 100
  time: number // 0 to 100
  gaps: number // 0 to 100, higher means fewer gaps matters more
}

export interface Preferences {
  earliestStart: string | null // "10:00"
  latestEnd: string | null // "18:00"
  daysOff: Day[]
  allowedStatus: ChosenStatus[]
  weights: Weights
  notes: string[] // anything Gemini understood that doesn't fit a field
}

// A recurring weekly block the user is busy for (from an imported .ics).
export interface BusyBlock {
  id: string
  title: string
  day: Day
  start: string
  end: string
}

export interface ScoreBreakdown {
  prof: number // 0 to 1
  time: number // 0 to 1
  gaps: number // 0 to 1
}

export interface Schedule {
  id: string
  sections: Section[]
  units: Unit[] // the components chosen, one per course component
  score: number // 0 to 100
  breakdown: ScoreBreakdown
  unplaced: string[] // course codes that could not fit
}

export interface Prof {
  name: string
  rmpName?: string
  rating: number | null // 1 to 5
  difficulty: number | null // 1 to 5
  wouldTakeAgain: number | null // percent
  numRatings: number
  summary: string | null // Gemini summary of reviews
  tags: string[]
}

export interface GenerateRequest {
  termId: string
  courseCodes: string[]
  preferences: Preferences
  busy: BusyBlock[]
}

export interface Explanation {
  scheduleId: string
  text: string
}

// ---------- Added when the backend landed ----------

// One component you take as a whole: every meeting of e.g. ITI1120 A01.
export interface Unit {
  key: string // "ITI1120|A01"
  courseCode: string
  sectionCode: string
  group: string
  type: SectionType
  status: SectionStatus
}

// An alternative time for one component, with the rest of the schedule unchanged.
export interface Alternative extends Unit {
  sections: Section[]
  score: number
  delta: number // change to the schedule's score if you take this instead
}

export interface AlternativesRequest {
  termId: string
  unitKey: string
  schedule: Schedule
  preferences: Preferences
  busy: BusyBlock[]
}

export interface Health {
  ok: boolean
  gemini: boolean
  auth: boolean
  googleCalendar: boolean
  liveCourseData: boolean
}

export interface CalendarPushResult {
  calendarId: string
  calendarName: string
  created: number
  failed: string[]
}
