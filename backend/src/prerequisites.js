// Prerequisites for the courses this app knows about. uoCampus class search does not
// show them (they live on the catalogue pages), so this is hardcoded like the program
// sequences in index.js. Check against the uOttawa catalogue before relying on it.
//
// Each entry is a list of requirements. Each requirement is a list of courses where
// passing any one is enough: [["MAT1320", "MAT1330"]] means MAT1320 or MAT1330.
// Courses not listed have no prerequisite we know of, and are never flagged.
// Mirrored in planner/src/api/mockData.ts.

const PREREQUISITES = {
    ITI1121: [["ITI1120"]],
    MAT1322: [["MAT1320", "MAT1330"]],
    MAT1332: [["MAT1330", "MAT1320"]],
    PHY1122: [["PHY1121"]],
    CHM1321: [["CHM1311"]],
};

export const prerequisitesFor = code => PREREQUISITES[String(code).toUpperCase()] || [];
