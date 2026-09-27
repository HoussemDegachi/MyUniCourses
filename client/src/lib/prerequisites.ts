import type { Course } from "@/types"

// A prerequisite has to be passed in an earlier term, so we can't check it (we don't
// know the student's transcript). We can only remind them, and catch the one case we
// can see: picking a course and its prerequisite for the same term.
export interface PrereqNote {
  needs: string[] // each requirement as text, e.g. "MAT1320 or MAT1330"
  sameTerm: string[] // selected courses that are prerequisites of this one
}

export function prereqNote(course: Course, selected: Course[]): PrereqNote | null {
  if (!course.prerequisites?.length) return null
  const codes = new Set(selected.map((c) => c.code))
  return {
    needs: course.prerequisites.map((req) => req.join(" or ")),
    sameTerm: course.prerequisites.flat().filter((code) => codes.has(code)),
  }
}

export function prereqText(course: Course, note: PrereqNote): string {
  if (note.sameTerm.length) {
    return `${course.code} needs ${note.sameTerm.join(" and ")} passed first, so they can't be taken in the same term.`
  }
  return `${course.code} needs ${note.needs.join(", and ")}. Make sure you've passed it before this term.`
}
