import type { BusyBlock, Section } from "@/types"
import { overlaps } from "@/lib/time"

// Returns the ids of every section or busy block that overlaps with something else.
export function findConflicts(sections: Section[], busy: BusyBlock[]): Set<string> {
  const hits = new Set<string>()

  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 1; j < sections.length; j++) {
      if (sectionsOverlap(sections[i], sections[j])) {
        hits.add(sections[i].id)
        hits.add(sections[j].id)
      }
    }
    for (const b of busy) {
      if (sections[i].days.includes(b.day) && overlaps(sections[i].start, sections[i].end, b.start, b.end)) {
        hits.add(sections[i].id)
        hits.add(b.id)
      }
    }
  }
  return hits
}

export function sectionsOverlap(a: Section, b: Section): boolean {
  return a.days.some((d) => b.days.includes(d)) && overlaps(a.start, a.end, b.start, b.end)
}

export function sectionHitsBusy(s: Section, busy: BusyBlock[]): boolean {
  return busy.some((b) => s.days.includes(b.day) && overlaps(s.start, s.end, b.start, b.end))
}
