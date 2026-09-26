// Each course keeps the same highlighter colour across every schedule option,
// so people can follow a course when they switch tabs.
const HIGHLIGHTERS = 8

export function courseColorVar(courseCode: string, orderedCodes: string[]): string {
  const idx = orderedCodes.indexOf(courseCode)
  const n = idx >= 0 ? idx : hash(courseCode)
  return `var(--hl-${(n % HIGHLIGHTERS) + 1})`
}

function hash(s: string): number {
  let h = 0
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}
