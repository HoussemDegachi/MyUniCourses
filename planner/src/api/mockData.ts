// Fake data so the frontend works before the scraper is done.
// Course codes are real uOttawa codes, but times, rooms and profs are made up.
// Prof names are fictional on purpose. Never pair real names with fake ratings.
import type { Course, Day, Prof, Section, SectionStatus, SectionType, Term } from "@/types"

export const TERMS: Term[] = [
  // Placeholder dates. Replace with the real ones from the uOttawa academic calendar.
  // noClassDates match what backend/src/terms.js computes for these ranges.
  {
    id: "2026-fall",
    name: "Fall 2026",
    startDate: "2026-09-09",
    endDate: "2026-12-09",
    noClassDates: ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17"],
  },
  {
    id: "2027-winter",
    name: "Winter 2027",
    startDate: "2027-01-11",
    endDate: "2027-04-12",
    noClassDates: ["2027-02-15", "2027-02-16", "2027-02-17", "2027-02-18", "2027-02-19", "2027-02-20", "2027-03-26"],
  },
]

// Same map as backend/src/prerequisites.js. Each inner list means "any one of these".
const PREREQUISITES: Record<string, string[][]> = {
  ITI1121: [["ITI1120"]],
  MAT1322: [["MAT1320", "MAT1330"]],
  MAT1332: [["MAT1330", "MAT1320"]],
  PHY1122: [["PHY1121"]],
  CHM1321: [["CHM1311"]],
}

const COURSE_LIST: Omit<Course, "prerequisites">[] = [
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
  { code: "ITI1100", title: "Digital Systems I", credits: 3 },
  { code: "PHY1121", title: "Fundamentals of Physics I", credits: 3 },
  { code: "PHY1122", title: "Fundamentals of Physics II", credits: 3 },
  { code: "CHM1311", title: "Principles of Chemistry", credits: 3 },
  { code: "CHM1321", title: "Organic Chemistry I", credits: 3 },
  { code: "BIO1130", title: "Introduction to Organismal Biology", credits: 3 },
  { code: "BIO1140", title: "Introduction to Cell Biology", credits: 3 },
  { code: "MAT1330", title: "Calculus for the Life Sciences I", credits: 3 },
  { code: "MAT1332", title: "Calculus for the Life Sciences II", credits: 3 },
  { code: "PSY1102", title: "Introduction to Psychology: Applications", credits: 3 },
  { code: "SOC1101", title: "Introduction to Sociology", credits: 3 },
  { code: "ECO1104", title: "Introduction to Microeconomics", credits: 3 },
  { code: "CRM1300", title: "Introduction to Criminology", credits: 3 },
]

export const COURSES: Course[] = COURSE_LIST.map((c) => ({ ...c, prerequisites: PREREQUISITES[c.code] ?? [] }))

// Program sequences for the "suggested courses" button. Hardcoded for the demo.
export const SEQUENCES: Record<string, { label: string; byTerm: Record<string, string[]> }> = {
  "cs-year1": seq("Computer Science", ["ITI1120", "MAT1320", "MAT1341", "MAT1348"], ["ITI1121", "MAT1322", "ENG1112"]),
  "seg-year1": seq("Software Engineering", ["ITI1100", "ITI1120", "MAT1320", "MAT1341", "ENG1112"], ["ITI1121", "MAT1322", "MAT1348", "PHY1122"]),
  "ceg-year1": seq("Computer Engineering", ["ITI1100", "ITI1120", "MAT1320", "MAT1341", "PHY1121"], ["ITI1121", "MAT1322", "MAT1348", "PHY1122", "ENG1112"]),
  "bio-year1": seq("Biology", ["BIO1130", "CHM1311", "MAT1330"], ["BIO1140", "CHM1321", "MAT1332"]),
  "psy-year1": seq("Psychology", ["PSY1101", "SOC1101", "PHI1101"], ["PSY1102", "ECO1102", "PHI1101"]),
  "eco-year1": seq("Economics", ["ECO1104", "SOC1101", "PSY1101"], ["ECO1102", "PSY1102", "PHI1101"]),
}

// Same lists as backend/index.js.
function seq(label: string, fall: string[], winter: string[]) {
  return { label, byTerm: { "2026-fall": fall, "2027-winter": winter } }
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

  // ITI1100
  sec("ITI1100", "A00", "LEC", ["TUE", "THU"], "14:30", "15:50", "Elodie Brannigan", "OPEN", "STE C0136"),
  sec("ITI1100", "A01", "LAB", ["FRI"], "08:30", "11:20", null, "OPEN", "STE 0131"),
  sec("ITI1100", "B00", "LEC", ["MON", "WED"], "16:00", "17:20", "Kwame Lindholm", "OPEN", "STE C0136"),
  sec("ITI1100", "B01", "LAB", ["THU"], "17:30", "20:20", null, "OPEN", "STE 0131"),

  // PHY1121
  sec("PHY1121", "A00", "LEC", ["MON", "WED"], "11:30", "12:50", "Mireille Dunsmore", "OPEN", "MRN 032"),
  sec("PHY1121", "A01", "DGD", ["TUE"], "17:30", "18:50", null, "OPEN", "MRN 032"),
  sec("PHY1121", "A02", "LAB", ["FRI"], "14:30", "17:20", null, "OPEN", "MCD 146"),
  sec("PHY1121", "B00", "LEC", ["TUE", "THU"], "16:00", "17:20", "Tariq Vandermeer", "OPEN", "MRN 032"),
  sec("PHY1121", "B01", "DGD", ["WED"], "08:30", "09:50", null, "OPEN", "MRN 032"),
  sec("PHY1121", "B02", "LAB", ["MON"], "17:30", "20:20", null, "WAITLIST", "MCD 146"),

  // PHY1122
  sec("PHY1122", "A00", "LEC", ["TUE", "THU"], "13:00", "14:20", "Anneliese Kowal", "OPEN", "MRN 032"),
  sec("PHY1122", "A01", "DGD", ["FRI"], "11:30", "12:50", null, "OPEN", "MRN 032"),
  sec("PHY1122", "B00", "LEC", ["MON", "WED"], "08:30", "09:50", "Desmond Aalto", "OPEN", "MRN 032"),
  sec("PHY1122", "B01", "DGD", ["THU"], "14:30", "15:50", null, "OPEN", "MRN 032"),

  // CHM1311
  sec("CHM1311", "A00", "LEC", ["MON", "WED"], "10:00", "11:20", "Beatrix Nwosu", "OPEN", "MRT 205"),
  sec("CHM1311", "A01", "LAB", ["TUE"], "13:00", "15:50", null, "OPEN", "DRO 215"),
  sec("CHM1311", "A02", "LAB", ["THU"], "13:00", "15:50", null, "WAITLIST", "DRO 215"),
  sec("CHM1311", "B00", "LEC", ["TUE", "THU"], "08:30", "09:50", "Callum Ferrante", "OPEN", "MRT 205"),
  sec("CHM1311", "B01", "LAB", ["FRI"], "13:00", "15:50", null, "OPEN", "DRO 215"),

  // CHM1321
  sec("CHM1321", "A00", "LEC", ["MON", "WED"], "08:30", "09:50", "Solenne Arbour", "OPEN", "MRT 205"),
  sec("CHM1321", "A01", "LAB", ["FRI"], "13:00", "15:50", null, "OPEN", "DRO 215"),
  sec("CHM1321", "B00", "LEC", ["TUE", "THU"], "16:00", "17:20", "Idris Halvorsen", "OPEN", "MRT 205"),
  sec("CHM1321", "B01", "LAB", ["WED"], "13:00", "15:50", null, "OPEN", "DRO 215"),

  // BIO1130
  sec("BIO1130", "A00", "LEC", ["TUE", "THU"], "11:30", "12:50", "Fiona Castellane", "OPEN", "GNN 1R40"),
  sec("BIO1130", "A01", "LAB", ["WED"], "13:00", "15:50", null, "OPEN", "GNN 110"),
  sec("BIO1130", "B00", "LEC", ["MON", "WED"], "14:30", "15:50", "Rohan Delacroix", "OPEN", "GNN 1R40"),
  sec("BIO1130", "B01", "LAB", ["FRI"], "08:30", "11:20", null, "OPEN", "GNN 110"),

  // BIO1140
  sec("BIO1140", "A00", "LEC", ["MON", "WED"], "11:30", "12:50", "Yara Stenholm", "OPEN", "GNN 1R40"),
  sec("BIO1140", "A01", "LAB", ["THU"], "13:00", "15:50", null, "OPEN", "GNN 110"),
  sec("BIO1140", "B00", "LEC", ["TUE", "THU"], "10:00", "11:20", "Emeric Tadesse", "OPEN", "GNN 1R40"),
  sec("BIO1140", "B01", "LAB", ["MON"], "14:30", "17:20", null, "OPEN", "GNN 110"),

  // MAT1330
  sec("MAT1330", "A00", "LEC", ["MON", "WED"], "08:30", "09:50", "Amira Haddad", "OPEN", "DMS 1140"),
  sec("MAT1330", "A01", "DGD", ["FRI"], "11:30", "12:50", null, "OPEN", "DMS 1140"),
  sec("MAT1330", "B00", "LEC", ["TUE", "THU"], "14:30", "15:50", "Paul Achterberg", "OPEN", "DMS 1140"),
  sec("MAT1330", "B01", "DGD", ["MON"], "16:00", "17:20", null, "OPEN", "DMS 1140"),

  // MAT1332
  sec("MAT1332", "A00", "LEC", ["TUE", "THU"], "08:30", "09:50", "Hélène Tremblay", "OPEN", "DMS 1140"),
  sec("MAT1332", "A01", "DGD", ["WED"], "10:00", "11:20", null, "OPEN", "DMS 1140"),
  sec("MAT1332", "B00", "LEC", ["MON", "WED"], "13:00", "14:20", "Ines Carvalho", "OPEN", "DMS 1140"),
  sec("MAT1332", "B01", "DGD", ["FRI"], "10:00", "11:20", null, "OPEN", "DMS 1140"),

  // PSY1102
  sec("PSY1102", "A00", "LEC", ["TUE", "THU"], "10:00", "11:20", "Colette Beaumont", "OPEN", "DMS 1140"),
  sec("PSY1102", "B00", "LEC", ["WED"], "18:00", "20:50", "Wendell Asante", "OPEN", "DMS 1140"),

  // SOC1101
  sec("SOC1101", "A00", "LEC", ["MON", "WED"], "10:00", "11:20", "Noor Castellvi", "OPEN", "FSS 2005"),
  sec("SOC1101", "B00", "LEC", ["THU"], "17:30", "20:20", "Theo Nakamura", "OPEN", "FSS 2005"),

  // ECO1104
  sec("ECO1104", "A00", "LEC", ["TUE", "THU"], "13:00", "14:20", "Leila Mansour", "OPEN", "DMS 1140"),
  sec("ECO1104", "B00", "LEC", ["MON"], "18:00", "20:50", "Brendan Kowalski", "OPEN", "DMS 1140"),

  // Waitlisted sections at good times, so demo schedules actually include some.
  sec("ITI1120", "A04", "DGD", ["WED"], "10:00", "11:20", null, "WAITLIST", "CRX C240"),
  sec("ITI1100", "A02", "LAB", ["THU"], "16:00", "18:50", null, "WAITLIST", "STE 0131"),
  sec("MAT1320", "B03", "DGD", ["WED"], "14:30", "15:50", null, "WAITLIST", "DMS 1140"),
  sec("MAT1341", "A02", "DGD", ["WED"], "11:30", "12:50", null, "WAITLIST", "FSS 2005"),
  sec("MAT1348", "B03", "DGD", ["THU"], "14:30", "15:50", null, "WAITLIST", "CRX C240"),
  sec("ITI1121", "A02", "LAB", ["WED"], "13:00", "15:50", null, "WAITLIST", "STE 2060"),
  sec("MAT1322", "A02", "DGD", ["THU"], "11:30", "12:50", null, "WAITLIST", "STE B0138"),
  sec("PHY1121", "A03", "LAB", ["WED"], "13:00", "15:50", null, "WAITLIST", "MCD 146"),
  sec("BIO1130", "A02", "LAB", ["THU"], "13:00", "15:50", null, "WAITLIST", "GNN 110"),
  sec("PSY1101", "C00", "LEC", ["TUE", "THU"], "10:00", "11:20", "Colette Beaumont", "WAITLIST", "DMS 1140"),
  sec("ECO1104", "C00", "LEC", ["WED", "FRI"], "10:00", "11:20", "Leila Mansour", "WAITLIST", "DMS 1140"),
  sec("CRM1300", "A00", "LEC", ["MON", "WED"], "11:30", "12:50", "Harriet Oduya", "WAITLIST", "FSS 1005"),
  sec("CRM1300", "B00", "LEC", ["TUE"], "18:00", "20:50", "Lucien Ferreol", "WAITLIST", "FSS 1005"),
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
  "Elodie Brannigan": p("Elodie Brannigan", 4.4, 3.5, 89, 52, "Clear circuit walkthroughs and labs that match the lectures.", ["Clear lectures", "Good labs"]),
  "Kwame Lindholm": p("Kwame Lindholm", 3.2, 3.9, 55, 31, "Late-afternoon lectures move fast. The textbook fills the gaps.", ["Fast-paced"]),
  "Mireille Dunsmore": p("Mireille Dunsmore", 4.2, 3.7, 84, 67, "Lots of worked problems in class. Midterms are tough but fair.", ["Worked examples", "Fair tests"]),
  "Tariq Vandermeer": p("Tariq Vandermeer", 2.8, 4.2, 41, 38, "Heavy on derivations. Many students study from past exams.", ["Tough grader"]),
  "Anneliese Kowal": p("Anneliese Kowal", 4.5, 3.4, 91, 44, "Makes electricity and magnetism feel manageable. Great office hours.", ["Helpful", "Office hours"]),
  // Desmond Aalto has no ratings on purpose
  "Beatrix Nwosu": p("Beatrix Nwosu", 4.6, 3.2, 94, 102, "Organized slides and weekly practice sets. Labs are well run.", ["Organized", "Practice sets"]),
  "Callum Ferrante": p("Callum Ferrante", 3.3, 3.6, 60, 48, "Early lectures, dense content. The review sessions before exams help.", ["Dense"]),
  "Solenne Arbour": p("Solenne Arbour", 4, 4.1, 78, 57, "Organic chem is hard, but her mechanism videos are excellent.", ["Challenging", "Great videos"]),
  "Idris Halvorsen": p("Idris Halvorsen", 3.1, 3.8, 52, 26, "Reads the textbook aloud. Exams are predictable.", ["Predictable exams"]),
  "Fiona Castellane": p("Fiona Castellane", 4.7, 2.8, 96, 83, "Enthusiastic and funny. Field examples make it stick.", ["Engaging", "Easy to follow"]),
  "Rohan Delacroix": p("Rohan Delacroix", 3.7, 3, 72, 35, "Solid lectures. Lab reports are graded strictly.", ["Strict lab grading"]),
  "Yara Stenholm": p("Yara Stenholm", 4.3, 3.5, 87, 61, "Clear diagrams and fair quizzes. Keep up with readings.", ["Clear", "Readings matter"]),
  "Emeric Tadesse": p("Emeric Tadesse", 3.4, 3.3, 63, 29, "Knowledgeable but monotone. Slides are posted early.", ["Slides posted"]),
  "Wendell Asante": p("Wendell Asante", 4.1, 2.4, 86, 40, "Long evening lecture with great stories and easy exams.", ["Easy exams", "Evening"]),
  "Harriet Oduya": p("Harriet Oduya", 4.6, 2.7, 93, 118, "So popular it fills every term. Case studies make every lecture interesting.", ["Engaging", "Fills fast"]),
  "Lucien Ferreol": p("Lucien Ferreol", 3.8, 2.4, 74, 30, "Long evening lecture, but fair exams and clear slides.", ["Evening", "Fair exams"]),
  // Noor Castellvi has no ratings on purpose
}

function p(name: string, rating: number, difficulty: number, wouldTakeAgain: number, numRatings: number, summary: string, tags: string[]): Prof {
  return { name, rating, difficulty, wouldTakeAgain, numRatings, summary, tags }
}
