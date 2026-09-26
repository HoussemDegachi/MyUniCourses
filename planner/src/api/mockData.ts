// Fake data so the frontend works before the scraper is done.
// Course codes are real uOttawa codes, but times, rooms and profs are made up.
// Prof names are fictional on purpose. Never pair real names with fake ratings.
import type { Course, Day, Prof, Section, SectionStatus, SectionType, Term } from "@/types"

export const TERMS: Term[] = [
  // Placeholder dates. Replace with the real ones from the uOttawa academic calendar.
  { id: "2026-fall", name: "Fall 2026", startDate: "2026-09-09", endDate: "2026-12-09" },
  { id: "2027-winter", name: "Winter 2027", startDate: "2027-01-11", endDate: "2027-04-12" },
]

export const COURSES: Course[] = [
  { code: "ITI1120", title: "Introduction to Computing I", credits: 3 },
  { code: "ITI1121", title: "Introduction to Computing II", credits: 3 },
  { code: "MAT1320", title: "Calculus I", credits: 3 },
  { code: "MAT1322", title: "Calculus II", credits: 3 },
  { code: "MAT1341", title: "Introduction to Linear Algebra", credits: 3 },
  { code: "MAT1348", title: "Discrete Mathematics for Computing", credits: 3 },
  { code: "PSY1101", title: "Introduction to Psychology: Foundations", credits: 3 },
  { code: "PHI1101", title: "Reasoning and Critical Thinking", credits: 3 },
  { code: "ECO1102", title: "Introduction to Macroeconomics", credits: 3 },
  { code: "ENG1112", title: "Technical Report Writing", credits: 3 },
]

// Program sequences for the "suggested courses" button. Hardcoded for the demo.
export const SEQUENCES: Record<string, { label: string; byTerm: Record<string, string[]> }> = {
  "cs-year1": {
    label: "Computer Science, year 1",
    byTerm: {
      "2026-fall": ["ITI1120", "MAT1320", "MAT1341", "MAT1348"],
      "2027-winter": ["ITI1121", "MAT1322", "ENG1112"],
    },
  },
}

let n = 0
function sec(
  courseCode: string,
  sectionCode: string,
  type: SectionType,
  days: Day[],
  start: string,
  end: string,
  prof: string | null,
  status: SectionStatus = "OPEN",
  location: string | null = null,
): Section {
  n++
  return {
    id: `${courseCode}-${sectionCode}-${type}-${n}`,
    courseCode,
    sectionCode,
    group: sectionCode.replace(/[^A-Za-z]/g, "") || "A",
    type,
    days,
    start,
    end,
    prof,
    location: location ?? pickRoom(courseCode, type),
    status,
  }
}

function pickRoom(code: string, type: SectionType): string {
  const rooms = type === "LAB" ? ["STE 0131", "STE 2060", "SITE 2052"] : ["CRX C240", "MRT 205", "FSS 2005", "DMS 1140", "STE B0138"]
  let h = 0
  for (const ch of code + type) h = (h + ch.charCodeAt(0)) % 97
  return rooms[h % rooms.length]
}

export const SECTIONS: Section[] = [
  // ITI1120
  sec("ITI1120", "A00", "LEC", ["MON", "WED"], "08:30", "09:50", "Dana Moreau"),
  sec("ITI1120", "A01", "DGD", ["FRI"], "10:00", "11:20", null),
  sec("ITI1120", "A02", "LAB", ["TUE"], "13:00", "14:20", null),
  sec("ITI1120", "A03", "LAB", ["THU"], "16:00", "17:20", null, "WAITLIST"),
  sec("ITI1120", "B00", "LEC", ["TUE", "THU"], "11:30", "12:50", "Rafael Okonkwo"),
  sec("ITI1120", "B01", "DGD", ["MON"], "16:00", "17:20", null),
  sec("ITI1120", "B02", "LAB", ["WED"], "14:30", "15:50", null),
  sec("ITI1120", "B03", "LAB", ["FRI"], "08:30", "09:50", null, "WAITLIST"),
  sec("ITI1120", "C00", "LEC", ["MON", "WED"], "17:30", "18:50", "Siri Lindqvist", "WAITLIST"),
  sec("ITI1120", "C01", "DGD", ["THU"], "19:00", "20:20", null, "WAITLIST"),
  sec("ITI1120", "C02", "LAB", ["TUE"], "19:00", "20:20", null, "WAITLIST"),

  // MAT1320
  sec("MAT1320", "A00", "LEC", ["TUE", "THU"], "08:30", "09:50", "Paul Achterberg"),
  sec("MAT1320", "A01", "DGD", ["WED"], "10:00", "11:20", null),
  sec("MAT1320", "B00", "LEC", ["MON", "WED"], "13:00", "14:20", "Amira Haddad"),
  sec("MAT1320", "B01", "DGD", ["FRI"], "13:00", "14:20", null),
  sec("MAT1320", "B02", "DGD", ["TUE"], "16:00", "17:20", null),
  sec("MAT1320", "C00", "LEC", ["TUE", "THU"], "14:30", "15:50", "Jonas Whitfield", "CLOSED"),
  sec("MAT1320", "C01", "DGD", ["MON"], "10:00", "11:20", null, "CLOSED"),

  // MAT1341
  sec("MAT1341", "A00", "LEC", ["MON", "WED"], "10:00", "11:20", "Hélène Tremblay"),
  sec("MAT1341", "A01", "DGD", ["THU"], "13:00", "14:20", null),
  sec("MAT1341", "B00", "LEC", ["TUE", "THU"], "10:00", "11:20", "Marcus Oyelaran"),
  sec("MAT1341", "B01", "DGD", ["FRI"], "11:30", "12:50", null),
  sec("MAT1341", "B02", "DGD", ["MON"], "14:30", "15:50", null),

  // MAT1348
  sec("MAT1348", "A00", "LEC", ["WED", "FRI"], "08:30", "09:50", "Ines Carvalho"),
  sec("MAT1348", "A01", "DGD", ["MON"], "11:30", "12:50", null),
  sec("MAT1348", "B00", "LEC", ["TUE", "THU"], "13:00", "14:20", "Victor Lam"),
  sec("MAT1348", "B01", "DGD", ["WED"], "16:00", "17:20", null),
  sec("MAT1348", "B02", "DGD", ["TUE"], "17:30", "18:50", null),

  // ITI1121
  sec("ITI1121", "A00", "LEC", ["MON", "WED"], "11:30", "12:50", "Rafael Okonkwo"),
  sec("ITI1121", "A01", "LAB", ["FRI"], "13:00", "15:50", null),
  sec("ITI1121", "B00", "LEC", ["TUE", "THU"], "16:00", "17:20", "Nadia Ferreira"),
  sec("ITI1121", "B01", "LAB", ["WED"], "13:00", "15:50", null),

  // MAT1322
  sec("MAT1322", "A00", "LEC", ["TUE", "THU"], "10:00", "11:20", "Amira Haddad"),
  sec("MAT1322", "A01", "DGD", ["FRI"], "10:00", "11:20", null),
  sec("MAT1322", "B00", "LEC", ["MON", "WED"], "16:00", "17:20", "Paul Achterberg"),
  sec("MAT1322", "B01", "DGD", ["THU"], "17:30", "18:50", null),

  // Electives
  sec("PSY1101", "A00", "LEC", ["MON"], "19:00", "21:50", "Colette Beaumont"),
  sec("PSY1101", "B00", "LEC", ["WED", "FRI"], "11:30", "12:50", "Theo Nakamura"),
  sec("PHI1101", "A00", "LEC", ["TUE", "THU"], "14:30", "15:50", "Grace Adeyemi"),
  sec("PHI1101", "B00", "LEC", ["FRI"], "14:30", "17:20", "Owen Castellano", "WAITLIST"),
  sec("ECO1102", "A00", "LEC", ["MON", "WED"], "14:30", "15:50", "Leila Mansour"),
  sec("ECO1102", "B00", "LEC", ["TUE"], "18:00", "20:50", "Brendan Kowalski"),
  sec("ENG1112", "A00", "LEC", ["WED"], "17:30", "20:20", "Maya Singh"),
  sec("ENG1112", "B00", "LEC", ["THU"], "08:30", "11:20", "Hugo Lefebvre"),
]

export const PROFS: Record<string, Prof> = {
  "Dana Moreau": p("Dana Moreau", 4.6, 3.1, 92, 88, "Explains code step by step and posts clear slides. Labs are fair and the midterm matches the practice exams.", ["Clear lectures", "Helpful"]),
  "Rafael Okonkwo": p("Rafael Okonkwo", 3.4, 3.8, 61, 54, "Knows the material well but moves fast. Assignments are long. Office hours help a lot.", ["Tough assignments", "Go to office hours"]),
  "Siri Lindqvist": p("Siri Lindqvist", 4.1, 2.7, 85, 23, "Relaxed evening section. Lectures are recorded and the exams are straightforward.", ["Recorded lectures", "Easy exams"]),
  "Paul Achterberg": p("Paul Achterberg", 2.6, 4.3, 38, 112, "Hard grader and the lectures are mostly proofs on the board. Many students rely on the textbook.", ["Tough grader", "Rely on textbook"]),
  "Amira Haddad": p("Amira Haddad", 4.7, 3.4, 95, 76, "Very organized and patient with questions. Weekly quizzes keep you on track.", ["Organized", "Weekly quizzes"]),
  "Jonas Whitfield": p("Jonas Whitfield", 3.9, 3.0, 80, 31, "Engaging lectures with lots of examples. The final is worth a lot.", ["Engaging", "Heavy final"]),
  "Hélène Tremblay": p("Hélène Tremblay", 4.3, 3.2, 88, 64, "Clear and bilingual notes. Attendance matters because of in-class exercises.", ["Clear notes", "Attendance matters"]),
  "Marcus Oyelaran": p("Marcus Oyelaran", 3.1, 3.5, 57, 40, "Lectures can be hard to follow, but the DGDs are very useful.", ["Go to DGDs"]),
  "Ines Carvalho": p("Ines Carvalho", 4.4, 3.6, 90, 47, "Challenging but fair. Great at making proofs make sense.", ["Fair", "Challenging"]),
  "Victor Lam": p("Victor Lam", 3.0, 4.0, 50, 29, "Assignments are much harder than the lectures. Start early.", ["Hard assignments"]),
  "Nadia Ferreira": p("Nadia Ferreira", 4.5, 3.3, 93, 58, "Practical examples and quick feedback on labs.", ["Practical", "Quick feedback"]),
  "Colette Beaumont": p("Colette Beaumont", 4.2, 2.1, 87, 140, "Interesting lectures and multiple-choice exams.", ["Easy A", "Interesting"]),
  "Theo Nakamura": p("Theo Nakamura", 3.6, 2.5, 70, 33, "Reads from slides, but exams come straight from them.", ["Slide-based"]),
  "Grace Adeyemi": p("Grace Adeyemi", 4.8, 2.9, 97, 81, "Students call this the most useful elective they took. Lots of discussion.", ["Inspirational", "Discussion-heavy"]),
  "Owen Castellano": p("Owen Castellano", 3.3, 2.8, 64, 19, "Long Friday lecture, but the content is easy.", ["Long lectures"]),
  "Leila Mansour": p("Leila Mansour", 4.0, 3.0, 82, 45, "Real-world examples and clear expectations.", ["Clear expectations"]),
  "Brendan Kowalski": p("Brendan Kowalski", 2.9, 3.6, 45, 27, "Evening lecture that runs long. Grading is inconsistent.", ["Inconsistent grading"]),
  "Maya Singh": p("Maya Singh", 4.1, 2.6, 84, 36, "Detailed feedback on every report.", ["Great feedback"]),
  "Hugo Lefebvre": p("Hugo Lefebvre", 3.5, 3.1, 66, 22, "Early morning but well structured.", ["Structured"]),
}

function p(name: string, rating: number, difficulty: number, wouldTakeAgain: number, numRatings: number, summary: string, tags: string[]): Prof {
  return { name, rating, difficulty, wouldTakeAgain, numRatings, summary, tags }
}
