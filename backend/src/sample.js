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

    ["ITI1100", "Digital Systems I", "A00", "LEC", "TuTh", "14:30", "15:50", "Elodie Brannigan", "Open", "STE C0136"],
    ["ITI1100", "Digital Systems I", "A01", "LAB", "Fr", "08:30", "11:20", null, "Open", "STE 0131"],
    ["ITI1100", "Digital Systems I", "B00", "LEC", "MoWe", "16:00", "17:20", "Kwame Lindholm", "Open", "STE C0136"],
    ["ITI1100", "Digital Systems I", "B01", "LAB", "Th", "17:30", "20:20", null, "Open", "STE 0131"],

    ["PHY1121", "Fundamentals of Physics I", "A00", "LEC", "MoWe", "11:30", "12:50", "Mireille Dunsmore", "Open", "MRN 032"],
    ["PHY1121", "Fundamentals of Physics I", "A01", "DGD", "Tu", "17:30", "18:50", null, "Open", "MRN 032"],
    ["PHY1121", "Fundamentals of Physics I", "A02", "LAB", "Fr", "14:30", "17:20", null, "Open", "MCD 146"],
    ["PHY1121", "Fundamentals of Physics I", "B00", "LEC", "TuTh", "16:00", "17:20", "Tariq Vandermeer", "Open", "MRN 032"],
    ["PHY1121", "Fundamentals of Physics I", "B01", "DGD", "We", "08:30", "09:50", null, "Open", "MRN 032"],
    ["PHY1121", "Fundamentals of Physics I", "B02", "LAB", "Mo", "17:30", "20:20", null, "Wait List", "MCD 146"],

    ["PHY1122", "Fundamentals of Physics II", "A00", "LEC", "TuTh", "13:00", "14:20", "Anneliese Kowal", "Open", "MRN 032"],
    ["PHY1122", "Fundamentals of Physics II", "A01", "DGD", "Fr", "11:30", "12:50", null, "Open", "MRN 032"],
    ["PHY1122", "Fundamentals of Physics II", "B00", "LEC", "MoWe", "08:30", "09:50", "Desmond Aalto", "Open", "MRN 032"],
    ["PHY1122", "Fundamentals of Physics II", "B01", "DGD", "Th", "14:30", "15:50", null, "Open", "MRN 032"],

    ["CHM1311", "Principles of Chemistry", "A00", "LEC", "MoWe", "10:00", "11:20", "Beatrix Nwosu", "Open", "MRT 205"],
    ["CHM1311", "Principles of Chemistry", "A01", "LAB", "Tu", "13:00", "15:50", null, "Open", "DRO 215"],
    ["CHM1311", "Principles of Chemistry", "A02", "LAB", "Th", "13:00", "15:50", null, "Wait List", "DRO 215"],
    ["CHM1311", "Principles of Chemistry", "B00", "LEC", "TuTh", "08:30", "09:50", "Callum Ferrante", "Open", "MRT 205"],
    ["CHM1311", "Principles of Chemistry", "B01", "LAB", "Fr", "13:00", "15:50", null, "Open", "DRO 215"],

    ["CHM1321", "Organic Chemistry I", "A00", "LEC", "MoWe", "08:30", "09:50", "Solenne Arbour", "Open", "MRT 205"],
    ["CHM1321", "Organic Chemistry I", "A01", "LAB", "Fr", "13:00", "15:50", null, "Open", "DRO 215"],
    ["CHM1321", "Organic Chemistry I", "B00", "LEC", "TuTh", "16:00", "17:20", "Idris Halvorsen", "Open", "MRT 205"],
    ["CHM1321", "Organic Chemistry I", "B01", "LAB", "We", "13:00", "15:50", null, "Open", "DRO 215"],

    ["BIO1130", "Introduction to Organismal Biology", "A00", "LEC", "TuTh", "11:30", "12:50", "Fiona Castellane", "Open", "GNN 1R40"],
    ["BIO1130", "Introduction to Organismal Biology", "A01", "LAB", "We", "13:00", "15:50", null, "Open", "GNN 110"],
    ["BIO1130", "Introduction to Organismal Biology", "B00", "LEC", "MoWe", "14:30", "15:50", "Rohan Delacroix", "Open", "GNN 1R40"],
    ["BIO1130", "Introduction to Organismal Biology", "B01", "LAB", "Fr", "08:30", "11:20", null, "Open", "GNN 110"],

    ["BIO1140", "Introduction to Cell Biology", "A00", "LEC", "MoWe", "11:30", "12:50", "Yara Stenholm", "Open", "GNN 1R40"],
    ["BIO1140", "Introduction to Cell Biology", "A01", "LAB", "Th", "13:00", "15:50", null, "Open", "GNN 110"],
    ["BIO1140", "Introduction to Cell Biology", "B00", "LEC", "TuTh", "10:00", "11:20", "Emeric Tadesse", "Open", "GNN 1R40"],
    ["BIO1140", "Introduction to Cell Biology", "B01", "LAB", "Mo", "14:30", "17:20", null, "Open", "GNN 110"],

    ["MAT1330", "Calculus for the Life Sciences I", "A00", "LEC", "MoWe", "08:30", "09:50", "Amira Haddad", "Open", "DMS 1140"],
    ["MAT1330", "Calculus for the Life Sciences I", "A01", "DGD", "Fr", "11:30", "12:50", null, "Open", "DMS 1140"],
    ["MAT1330", "Calculus for the Life Sciences I", "B00", "LEC", "TuTh", "14:30", "15:50", "Paul Achterberg", "Open", "DMS 1140"],
    ["MAT1330", "Calculus for the Life Sciences I", "B01", "DGD", "Mo", "16:00", "17:20", null, "Open", "DMS 1140"],

    ["MAT1332", "Calculus for the Life Sciences II", "A00", "LEC", "TuTh", "08:30", "09:50", "Hélène Tremblay", "Open", "DMS 1140"],
    ["MAT1332", "Calculus for the Life Sciences II", "A01", "DGD", "We", "10:00", "11:20", null, "Open", "DMS 1140"],
    ["MAT1332", "Calculus for the Life Sciences II", "B00", "LEC", "MoWe", "13:00", "14:20", "Ines Carvalho", "Open", "DMS 1140"],
    ["MAT1332", "Calculus for the Life Sciences II", "B01", "DGD", "Fr", "10:00", "11:20", null, "Open", "DMS 1140"],

    ["PSY1102", "Introduction to Psychology: Applications", "A00", "LEC", "TuTh", "10:00", "11:20", "Colette Beaumont", "Open", "DMS 1140"],
    ["PSY1102", "Introduction to Psychology: Applications", "B00", "LEC", "We", "18:00", "20:50", "Wendell Asante", "Open", "DMS 1140"],
    ["SOC1101", "Introduction to Sociology", "A00", "LEC", "MoWe", "10:00", "11:20", "Noor Castellvi", "Open", "FSS 2005"],
    ["SOC1101", "Introduction to Sociology", "B00", "LEC", "Th", "17:30", "20:20", "Theo Nakamura", "Open", "FSS 2005"],
    ["ECO1104", "Introduction to Microeconomics", "A00", "LEC", "TuTh", "13:00", "14:20", "Leila Mansour", "Open", "DMS 1140"],
    ["ECO1104", "Introduction to Microeconomics", "B00", "LEC", "Mo", "18:00", "20:50", "Brendan Kowalski", "Open", "DMS 1140"],

    ["PSY1101", "Introduction to Psychology: Foundations", "A00", "LEC", "Mo", "19:00", "21:50", "Colette Beaumont", "Open", "DMS 1140"],
    ["PSY1101", "Introduction to Psychology: Foundations", "B00", "LEC", "WeFr", "11:30", "12:50", "Theo Nakamura", "Open", "DMS 1140"],
    ["PHI1101", "Reasoning and Critical Thinking", "A00", "LEC", "TuTh", "14:30", "15:50", "Grace Adeyemi", "Open", "FSS 2005"],
    ["PHI1101", "Reasoning and Critical Thinking", "B00", "LEC", "Fr", "14:30", "17:20", "Owen Castellano", "Wait List", "FSS 2005"],
    ["ECO1102", "Introduction to Macroeconomics", "A00", "LEC", "MoWe", "14:30", "15:50", "Leila Mansour", "Open", "DMS 1140"],
    ["ECO1102", "Introduction to Macroeconomics", "B00", "LEC", "Tu", "18:00", "20:50", "Brendan Kowalski", "Open", "DMS 1140"],
    ["ENG1112", "Technical Report Writing", "A00", "LEC", "We", "17:30", "20:20", "Maya Singh", "Open", "CRX C240"],
    ["ENG1112", "Technical Report Writing", "B00", "LEC", "Th", "08:30", "11:20", "Hugo Lefebvre", "Open", "CRX C240"],

    // Waitlisted sections at good times, so demo schedules actually include some.
    ["ITI1120", "Introduction to Computing I", "A04", "DGD", "We", "10:00", "11:20", null, "Wait List", "CRX C240"],
    ["ITI1100", "Digital Systems I", "A02", "LAB", "Th", "16:00", "18:50", null, "Wait List", "STE 0131"],
    ["MAT1320", "Calculus I", "B03", "DGD", "We", "14:30", "15:50", null, "Wait List", "DMS 1140"],
    ["MAT1341", "Introduction to Linear Algebra", "A02", "DGD", "We", "11:30", "12:50", null, "Wait List", "FSS 2005"],
    ["MAT1348", "Discrete Mathematics for Computing", "B03", "DGD", "Th", "14:30", "15:50", null, "Wait List", "CRX C240"],
    ["ITI1121", "Introduction to Computing II", "A02", "LAB", "We", "13:00", "15:50", null, "Wait List", "STE 2060"],
    ["MAT1322", "Calculus II", "A02", "DGD", "Th", "11:30", "12:50", null, "Wait List", "STE B0138"],
    ["PHY1121", "Fundamentals of Physics I", "A03", "LAB", "We", "13:00", "15:50", null, "Wait List", "MCD 146"],
    ["BIO1130", "Introduction to Organismal Biology", "A02", "LAB", "Th", "13:00", "15:50", null, "Wait List", "GNN 110"],
    ["PSY1101", "Introduction to Psychology: Foundations", "C00", "LEC", "TuTh", "10:00", "11:20", "Colette Beaumont", "Wait List", "DMS 1140"],
    ["ECO1104", "Introduction to Microeconomics", "C00", "LEC", "WeFr", "10:00", "11:20", "Leila Mansour", "Wait List", "DMS 1140"],
    ["CRM1300", "Introduction to Criminology", "A00", "LEC", "MoWe", "11:30", "12:50", "Harriet Oduya", "Wait List", "FSS 1005"],
    ["CRM1300", "Introduction to Criminology", "B00", "LEC", "Tu", "18:00", "20:50", "Lucien Ferreol", "Wait List", "FSS 1005"],
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
    "Elodie Brannigan": [4.4, 3.5, 89, 52, "Clear circuit walkthroughs and labs that match the lectures.", ["Clear lectures", "Good labs"]],
    "Kwame Lindholm": [3.2, 3.9, 55, 31, "Late-afternoon lectures move fast. The textbook fills the gaps.", ["Fast-paced"]],
    "Mireille Dunsmore": [4.2, 3.7, 84, 67, "Lots of worked problems in class. Midterms are tough but fair.", ["Worked examples", "Fair tests"]],
    "Tariq Vandermeer": [2.8, 4.2, 41, 38, "Heavy on derivations. Many students study from past exams.", ["Tough grader"]],
    "Anneliese Kowal": [4.5, 3.4, 91, 44, "Makes electricity and magnetism feel manageable. Great office hours.", ["Helpful", "Office hours"]],
    "Beatrix Nwosu": [4.6, 3.2, 94, 102, "Organized slides and weekly practice sets. Labs are well run.", ["Organized", "Practice sets"]],
    "Callum Ferrante": [3.3, 3.6, 60, 48, "Early lectures, dense content. The review sessions before exams help.", ["Dense"]],
    "Solenne Arbour": [4.0, 4.1, 78, 57, "Organic chem is hard, but her mechanism videos are excellent.", ["Challenging", "Great videos"]],
    "Idris Halvorsen": [3.1, 3.8, 52, 26, "Reads the textbook aloud. Exams are predictable.", ["Predictable exams"]],
    "Fiona Castellane": [4.7, 2.8, 96, 83, "Enthusiastic and funny. Field examples make it stick.", ["Engaging", "Easy to follow"]],
    "Rohan Delacroix": [3.7, 3.0, 72, 35, "Solid lectures. Lab reports are graded strictly.", ["Strict lab grading"]],
    "Yara Stenholm": [4.3, 3.5, 87, 61, "Clear diagrams and fair quizzes. Keep up with readings.", ["Clear", "Readings matter"]],
    "Emeric Tadesse": [3.4, 3.3, 63, 29, "Knowledgeable but monotone. Slides are posted early.", ["Slides posted"]],
    "Wendell Asante": [4.1, 2.4, 86, 40, "Long evening lecture with great stories and easy exams.", ["Easy exams", "Evening"]],
    "Harriet Oduya": [4.6, 2.7, 93, 118, "So popular it fills every term. Case studies make every lecture interesting.", ["Engaging", "Fills fast"]],
    "Lucien Ferreol": [3.8, 2.4, 74, 30, "Long evening lecture, but fair exams and clear slides.", ["Evening", "Fair exams"]],
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
