// The only file the UI talks to.
//
// Auth: the app registers a token getter at startup (see AuthProvider). Requests
// that need an account attach the Auth0 access token. Everything else works
// signed out.

import type {
  Alternative,
  AlternativesRequest,
  CalendarPushResult,
  Course,
  Explanation,
  GenerateRequest,
  Health,
  Preferences,
  Prof,
  Schedule,
  Section,
  Term,
} from "@/types"
import { API_BASE, USE_MOCKS } from "@/config"
import * as mocks from "@/api/mocks"

type TokenGetter = () => Promise<string | null>

let getToken: TokenGetter = async () => null

export function setTokenGetter(fn: TokenGetter) {
  getToken = fn
}

export class ApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function http<T>(path: string, init?: RequestInit & { auth?: boolean }): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }

  if (init?.auth) {
    const token = await getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers: { ...headers, ...init?.headers } })
  } catch {
    throw new ApiError("Can't reach the server. Check that the backend is running.", 0)
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(body.error || `Request failed (${res.status}).`, res.status, body.code)
  }

  return res.json() as Promise<T>
}

const post = <T>(path: string, body: unknown, auth = false) =>
  http<T>(path, { method: "POST", body: JSON.stringify(body), auth })

export const api = {
  health: (): Promise<Health> =>
    USE_MOCKS
      ? Promise.resolve({ ok: true, gemini: true, auth: false, googleCalendar: false, liveCourseData: false })
      : http("/api/health"),

  getTerms: (): Promise<Term[]> => (USE_MOCKS ? mocks.getTerms() : http("/api/terms")),

  searchCourses: (termId: string, query: string): Promise<Course[]> =>
    USE_MOCKS
      ? mocks.searchCourses(termId, query)
      : http(`/api/courses?term=${encodeURIComponent(termId)}&q=${encodeURIComponent(query)}`),

  getSequence: (program: string, termId: string): Promise<string[]> =>
    USE_MOCKS
      ? mocks.getSequence(program, termId)
      : http(`/api/sequences/${encodeURIComponent(program)}?term=${encodeURIComponent(termId)}`),

  getSections: (termId: string, courseCodes: string[]): Promise<Section[]> =>
    USE_MOCKS
      ? mocks.getSections(termId, courseCodes)
      : http(`/api/sections?term=${encodeURIComponent(termId)}&courses=${courseCodes.map(encodeURIComponent).join(",")}`),

  getProf: (name: string): Promise<Prof | null> =>
    USE_MOCKS ? mocks.getProf(name) : http(`/api/profs/${encodeURIComponent(name)}/summary`),

  parsePreferences: (prompt: string, current: Preferences): Promise<Preferences> =>
    USE_MOCKS ? mocks.parsePreferences(prompt, current) : post("/api/preferences/parse", { prompt, current }),

  generate: (req: GenerateRequest): Promise<Schedule[]> =>
    USE_MOCKS ? mocks.generate(req) : post("/api/schedules/generate", req),

  explain: (schedules: Schedule[], preferences: Preferences): Promise<Explanation[]> =>
    USE_MOCKS ? mocks.explain(schedules, preferences) : post("/api/schedules/explain", { schedules, preferences }),

  alternatives: (req: AlternativesRequest): Promise<Alternative[]> =>
    USE_MOCKS ? mocks.alternatives(req) : post("/api/schedules/alternatives", req),

  pushToGoogleCalendar: (schedule: Schedule, term: Term): Promise<CalendarPushResult> =>
    post("/api/calendar/push", { schedule, term }, true),
}
