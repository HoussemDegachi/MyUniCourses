// Change the name here once the team picks one. It's used in the header and exports.
export const APP_NAME = "Profound"

// Sample data lets the UI run before the backend is up.
// Set VITE_USE_MOCKS=false in .env.local to use the real API.
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true"

export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8080"

// Auth0. Leave unset and the sign-in button hides itself.
export const AUTH0_DOMAIN = import.meta.env.VITE_AUTH0_DOMAIN ?? ""
export const AUTH0_CLIENT_ID = import.meta.env.VITE_AUTH0_CLIENT_ID ?? ""
export const AUTH0_AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE ?? ""
export const AUTH_CONFIGURED = Boolean(AUTH0_DOMAIN && AUTH0_CLIENT_ID && AUTH0_AUDIENCE)

// Asking Google for calendar permission at sign-in, so we never have to ask twice.
export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar"

// A full-time uOttawa load is five courses a term. Matches MAX_COURSES in backend/index.js.
export const MAX_COURSES = 5

// The best match plus one alternative. The generator still ranks more than this.
export const SHOWN_SCHEDULES = 2

// The grid never shows a wider day than this, and never a narrower one.
export const GRID_MIN_HOUR = 8
export const GRID_MAX_HOUR = 22

// Programs offered in the "suggested courses" picker. Ids match SEQUENCES in backend/index.js.
export const PROGRAMS = [
  { id: "cs-year1", label: "Computer Science" },
  { id: "seg-year1", label: "Software Engineering" },
  { id: "ceg-year1", label: "Computer Engineering" },
  { id: "bio-year1", label: "Biology" },
  { id: "psy-year1", label: "Psychology" },
  { id: "eco-year1", label: "Economics" },
]
