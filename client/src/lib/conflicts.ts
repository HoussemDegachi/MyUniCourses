import type { BusyBlock, Section } from "@/types"
import { hitsBusy, sectionsOverlap } from "@/lib/generator"

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
      if (hitsBusy(sections[i], [b])) {
        hits.add(sections[i].id)
        hits.add(b.id)
      }
    }
  }
  return hits
}
