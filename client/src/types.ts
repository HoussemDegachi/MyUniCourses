// Shared data shapes. Keep these identical to the backend's JSON.
// If the backend changes a field, change it here first.

export type Day = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN"

export type SectionType = "LEC" | "DGD" | "LAB" | "TUT" | "SEM"

// CLOSED sections exist in the data but are never offered to the student,
// so the UI only ever asks about OPEN and WAITLIST.
export type SectionStatus = "OPEN" | "WAITLIST" | "CLOSED"
export type ChosenStatus = "OPEN" | "WAITLIST"

export interface Term {
  id: string // uoCampus term code, e.g. "2269". A string because that's what the backend sends.
  name: string // e.g. "2026 Fall Term"
  startDate: string // ISO date, first day of classes
  endDate: string // ISO date, last day of classes
  noClassDates: string[] // ISO dates inside the term with no classes: reading week, holidays
}

export interface Course {
  code: string // "ITI1120"
  title: string
  credits: number
  // Each inner list is one requirement; passing any course in it satisfies it.
  // [["MAT1320", "MAT1330"]] means MAT1320 or MAT1330. Empty means none we know of.
  prerequisites: string[][]
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

// Part of one day the student wants kept free, e.g. Friday afternoon for clubs.
// Soft, like daysOff: a class there lowers the time score instead of being ruled out.
export interface FreeTime {
  day: Day
  start: string // "12:00"
  end: string // "18:00"
}

export interface Preferences {
  earliestStart: string | null // "10:00"
  latestEnd: string | null // "18:00"
  daysOff: Day[]
  freeTimes: FreeTime[]
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
  unplaced: Unplaced[] // courses that could not fit, and why
  builtBy?: "gemini" | "generator" // who picked the sections; the generator steps in when Gemini can't
}

// NOT_OFFERED  no sections this term
// FULL         every section is closed
// WAITLIST_ONLY  only waitlisted sections left, and waitlists are turned off
// BUSY         every usable section overlaps a busy block
// CLASH        it can't fit around the other courses in this schedule
export type UnplacedReason = "NOT_OFFERED" | "FULL" | "WAITLIST_ONLY" | "BUSY" | "CLASH"

export interface Unplaced {
  courseCode: string
  reason: UnplacedReason
  conflictsWith: string[] // BUSY: busy block titles. CLASH: course codes in this schedule.
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
  prompt?: string // the student's own words, sent to Gemini to build from
}

// Written by Gemini from facts the generator computed, or by fixed wording when the
// AI is off. Either way it only restates those facts.
export interface Explanation {
  scheduleId: string
  text: string // two or three sentence summary
  strengths: string[]
  tradeoffs: string[]
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
