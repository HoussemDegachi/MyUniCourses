// Sample data used when uoCampus can't be reached (their site blocks some networks,
// and it goes down during registration weeks). The API keeps working and every
// response says sample: true so the UI can tell the student.

const TERMS = [
    { id: "2269", name: "2026 Fall Term", startDate: "2026-09-09", endDate: "2026-12-09" },
    { id: "2271", name: "2027 Winter Term", startDate: "2027-01-11", endDate: "2027-04-12" },
];

const RAW = [
    ["ITI1120", "Introduction to Computing I", "A00", "LEC", "MoWe", "08:30", "09:50", "Dana Moreau", "Open", "MRT 205"],
    ["ITI1120", "Introduction to Computing I", "A01", "DGD", "Fr", "10:00", "11:20", null, "Open", "CRX C240"],
    ["ITI1120", "Introduction to Computing I", "A02", "LAB", "Tu", "13:00", "14:20", null, "Open", "STE 0131"],
    ["ITI1120", "Introduction to Computing I", "A03", "LAB", "Th", "16:00", "17:20", null, "Wait List", "STE 0131"],
    ["ITI1120", "Introduction to Computing I", "B00", "LEC", "TuTh", "11:30", "12:50", "Rafael Okonkwo", "Open", "MRT 205"],
    ["ITI1120", "Introduction to Computing I", "B01", "DGD", "Mo", "16:00", "17:20", null, "Open", "CRX C240"],
    ["ITI1120", "Introduction to Computing I", "B02", "LAB", "We", "14:30", "15:50", null, "Open", "STE 2060"],
    ["ITI1120", "Introduction to Computing I", "C00", "LEC", "MoWe", "17:30", "18:50", "Siri Lindqvist", "Wait List", "FSS 2005"],
    ["ITI1120", "Introduction to Computing I", "C01", "DGD", "Th", "19:00", "20:20", null, "Wait List", "FSS 2005"],
    ["ITI1120", "Introduction to Computing I", "C02", "LAB", "Tu", "19:00", "20:20", null, "Wait List", "STE 0131"],

    ["MAT1320", "Calculus I", "A00", "LEC", "TuTh", "08:30", "09:50", "Paul Achterberg", "Open", "STE B0138"],
    ["MAT1320", "Calculus I", "A01", "DGD", "We", "10:00", "11:20", null, "Open", "STE B0138"],
    ["MAT1320", "Calculus I", "B00", "LEC", "MoWe", "13:00", "14:20", "Amira Haddad", "Open", "DMS 1140"],
    ["MAT1320", "Calculus I", "B01", "DGD", "Fr", "13:00", "14:20", null, "Open", "DMS 1140"],
    ["MAT1320", "Calculus I", "B02", "DGD", "Tu", "16:00", "17:20", null, "Open", "DMS 1140"],
    ["MAT1320", "Calculus I", "C00", "LEC", "TuTh", "14:30", "15:50", "Jonas Whitfield", "Closed", "STE B0138"],
    ["MAT1320", "Calculus I", "C01", "DGD", "Mo", "10:00", "11:20", null, "Closed", "STE B0138"],

    ["MAT1341", "Introduction to Linear Algebra", "A00", "LEC", "MoWe", "10:00", "11:20", "Hélène Tremblay", "Open", "FSS 2005"],
    ["MAT1341", "Introduction to Linear Algebra", "A01", "DGD", "Th", "13:00", "14:20", null, "Open", "FSS 2005"],
    ["MAT1341", "Introduction to Linear Algebra", "B00", "LEC", "TuTh", "10:00", "11:20", "Marcus Oyelaran", "Open", "MRT 205"],
    ["MAT1341", "Introduction to Linear Algebra", "B01", "DGD", "Fr", "11:30", "12:50", null, "Open", "MRT 205"],
    ["MAT1341", "Introduction to Linear Algebra", "B02", "DGD", "Mo", "14:30", "15:50", null, "Open", "MRT 205"],

    ["MAT1348", "Discrete Mathematics for Computing", "A00", "LEC", "WeFr", "08:30", "09:50", "Ines Carvalho", "Open", "STE B0138"],
    ["MAT1348", "Discrete Mathematics for Computing", "A01", "DGD", "Mo", "11:30", "12:50", null, "Open", "STE B0138"],
    ["MAT1348", "Discrete Mathematics for Computing", "B00", "LEC", "TuTh", "13:00", "14:20", "Victor Lam", "Open", "CRX C240"],
    ["MAT1348", "Discrete Mathematics for Computing", "B01", "DGD", "We", "16:00", "17:20", null, "Open", "CRX C240"],
    ["MAT1348", "Discrete Mathematics for Computing", "B02", "DGD", "Tu", "17:30", "18:50", null, "Open", "CRX C240"],

    ["ITI1121", "Introduction to Computing II", "A00", "LEC", "MoWe", "11:30", "12:50", "Rafael Okonkwo", "Open", "MRT 205"],
    ["ITI1121", "Introduction to Computing II", "A01", "LAB", "Fr", "13:00", "15:50", null, "Open", "STE 2060"],
    ["ITI1121", "Introduction to Computing II", "B00", "LEC", "TuTh", "16:00", "17:20", "Nadia Ferreira", "Open", "FSS 2005"],
    ["ITI1121", "Introduction to Computing II", "B01", "LAB", "We", "13:00", "15:50", null, "Open", "STE 2060"],

    ["MAT1322", "Calculus II", "A00", "LEC", "TuTh", "10:00", "11:20", "Amira Haddad", "Open", "STE B0138"],
    ["MAT1322", "Calculus II", "A01", "DGD", "Fr", "10:00", "11:20", null, "Open", "STE B0138"],
    ["MAT1322", "Calculus II", "B00", "LEC", "MoWe", "16:00", "17:20", "Paul Achterberg", "Open", "DMS 1140"],
    ["MAT1322", "Calculus II", "B01", "DGD", "Th", "17:30", "18:50", null, "Open", "DMS 1140"],

    ["PSY1101", "Introduction to Psychology: Foundations", "A00", "LEC", "Mo", "19:00", "21:50", "Colette Beaumont", "Open", "DMS 1140"],
    ["PSY1101", "Introduction to Psychology: Foundations", "B00", "LEC", "WeFr", "11:30", "12:50", "Theo Nakamura", "Open", "DMS 1140"],
    ["PHI1101", "Reasoning and Critical Thinking", "A00", "LEC", "TuTh", "14:30", "15:50", "Grace Adeyemi", "Open", "FSS 2005"],
    ["PHI1101", "Reasoning and Critical Thinking", "B00", "LEC", "Fr", "14:30", "17:20", "Owen Castellano", "Wait List", "FSS 2005"],
    ["ECO1102", "Introduction to Macroeconomics", "A00", "LEC", "MoWe", "14:30", "15:50", "Leila Mansour", "Open", "DMS 1140"],
    ["ECO1102", "Introduction to Macroeconomics", "B00", "LEC", "Tu", "18:00", "20:50", "Brendan Kowalski", "Open", "DMS 1140"],
    ["ENG1112", "Technical Report Writing", "A00", "LEC", "We", "17:30", "20:20", "Maya Singh", "Open", "CRX C240"],
    ["ENG1112", "Technical Report Writing", "B00", "LEC", "Th", "08:30", "11:20", "Hugo Lefebvre", "Open", "CRX C240"],
];

// Prof names here are invented. Never show a real prof beside a made-up rating.
const PROFS = {
    "Dana Moreau": [4.6, 3.1, 92, 88, "Explains code step by step and posts clear slides. Labs are fair and the midterm matches the practice exams.", ["Clear lectures", "Helpful"]],
    "Rafael Okonkwo": [3.4, 3.8, 61, 54, "Knows the material well but moves fast. Assignments are long. Office hours help a lot.", ["Tough assignments", "Go to office hours"]],
    "Siri Lindqvist": [4.1, 2.7, 85, 23, "Relaxed evening section. Lectures are recorded and the exams are straightforward.", ["Recorded lectures", "Easy exams"]],
    "Paul Achterberg": [2.6, 4.3, 38, 112, "Hard grader and the lectures are mostly proofs on the board. Many students rely on the textbook.", ["Tough grader", "Rely on textbook"]],
    "Amira Haddad": [4.7, 3.4, 95, 76, "Very organized and patient with questions. Weekly quizzes keep you on track.", ["Organized", "Weekly quizzes"]],
    "Jonas Whitfield": [3.9, 3.0, 80, 31, "Engaging lectures with lots of examples. The final is worth a lot.", ["Engaging", "Heavy final"]],
    "Hélène Tremblay": [4.3, 3.2, 88, 64, "Clear and bilingual notes. Attendance matters because of in-class exercises.", ["Clear notes", "Attendance matters"]],
    "Marcus Oyelaran": [3.1, 3.5, 57, 40, "Lectures can be hard to follow, but the DGDs are very useful.", ["Go to DGDs"]],
    "Ines Carvalho": [4.4, 3.6, 90, 47, "Challenging but fair. Great at making proofs make sense.", ["Fair", "Challenging"]],
    "Victor Lam": [3.0, 4.0, 50, 29, "Assignments are much harder than the lectures. Start early.", ["Hard assignments"]],
    "Nadia Ferreira": [4.5, 3.3, 93, 58, "Practical examples and quick feedback on labs.", ["Practical", "Quick feedback"]],
    "Colette Beaumont": [4.2, 2.1, 87, 140, "Interesting lectures and multiple-choice exams.", ["Easy A", "Interesting"]],
    "Theo Nakamura": [3.6, 2.5, 70, 33, "Reads from slides, but exams come straight from them.", ["Slide-based"]],
    "Grace Adeyemi": [4.8, 2.9, 97, 81, "Students call this the most useful elective they took. Lots of discussion.", ["Discussion-heavy"]],
    "Owen Castellano": [3.3, 2.8, 64, 19, "Long Friday lecture, but the content is easy.", ["Long lectures"]],
    "Leila Mansour": [4.0, 3.0, 82, 45, "Real-world examples and clear expectations.", ["Clear expectations"]],
    "Brendan Kowalski": [2.9, 3.6, 45, 27, "Evening lecture that runs long. Grading is inconsistent.", ["Inconsistent grading"]],
    "Maya Singh": [4.1, 2.6, 84, 36, "Detailed feedback on every report.", ["Great feedback"]],
    "Hugo Lefebvre": [3.5, 3.1, 66, 22, "Early morning but well structured.", ["Structured"]],
};

export function sampleTerms()
{
    return TERMS;
}

// Same shape the scraper produces, so the rest of the server can't tell the difference.
export function sampleScraped(termId, courseCodes = null, subject = null)
{
    const term = TERMS.find(t => t.id === String(termId)) || TERMS[0];
    return RAW
        .filter(([code]) => (!courseCodes || courseCodes.includes(code)) && (!subject || code.startsWith(subject)))
        .map(([course, title, section, component, days, start, end, instructor, status, room]) => ({
            term: term.id,
            course,
            title,
            section,
            component,
            status,
            open: status === "Open",
            meetings: [{ days, start, end, instructor, startDate: term.startDate, endDate: term.endDate, room }],
        }));
}

export function sampleProf(name)
{
    const p = PROFS[name];
    if (!p) return null;
    return { name, rmpName: name, rating: p[0], difficulty: p[1], wouldTakeAgain: p[2], numRatings: p[3], summary: p[4], tags: p[5], reviews: [] };
}
