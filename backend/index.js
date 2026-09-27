import "dotenv/config";
import cors from "cors";
import express from "express";

import { readUser, requireUser, authEnabled } from "./src/auth.js";
import { calendarEnabled, pushSchedule } from "./src/calendar.js";
import { scraperIsUp, searchCourses, sectionsFor, terms, useSample } from "./src/catalog.js";
import { explainSchedules, geminiEnabled, parsePreferences } from "./src/gemini.js";
import {
    alternativesFor,
    describeDetails,
    describeSchedule,
    generateSchedules,
    scheduleFacts,
    scoreBreakdown,
} from "./src/generator.js";
import { profMap, profSummary } from "./src/profs.js";
import { buildSchedules } from "./ai/generation.js";
import aiScheduleRouter from "./routes/schedule.js";

const app = express();
const PORT = process.env.PORT || 8080;
const APP_NAME = process.env.APP_NAME || "myUni.Courses";
// Most courses a student can plan at once. Matches MAX_COURSES in client/src/config.ts.
const MAX_COURSES = 6;

// Any site may call the API unless CORS_ORIGIN lists specific ones. That's safe here: no
// cookies are used, and anything touching an account needs an Auth0 token anyway.
const corsOrigins = (process.env.CORS_ORIGIN || "*").split(",").map(o => o.trim()).filter(Boolean);
app.use(cors({ origin: corsOrigins.includes("*") ? true : corsOrigins, credentials: false }));
app.use(express.json({ limit: "1mb" }));
app.use(readUser);

// Keeps every route from needing its own try/catch.
const route = handler => (req, res) => handler(req, res).catch(err =>
{
    console.error(`${req.method} ${req.path}`, err.message);
    res.status(err.status || 500).json({ error: err.message || "Something went wrong." });
});

const DEFAULT_PREFERENCES = {
    earliestStart: null,
    latestEnd: null,
    daysOff: [],
    freeTimes: [],
    allowedStatus: ["OPEN", "WAITLIST"],
    weights: { prof: 50, time: 50, gaps: 50 },
    notes: [],
};

// ---------- Status ----------

app.get("/api/health", (_req, res) => res.json({
    ok: true,
    gemini: geminiEnabled(),
    auth: authEnabled(),
    googleCalendar: calendarEnabled(),
    liveCourseData: !useSample() && scraperIsUp(),
}));

// ---------- Course data ----------

app.get("/api/terms", route(async (_req, res) => res.json(await terms())));

app.get("/api/courses", route(async (req, res) =>
{
    const { term, q = "" } = req.query;
    if (!term) return res.status(400).json({ error: "term is required" });
    res.json(await searchCourses(String(term), String(q)));
}));

app.get("/api/sections", route(async (req, res) =>
{
    const { term, courses = "" } = req.query;
    if (!term) return res.status(400).json({ error: "term is required" });
    const codes = String(courses).split(",").map(c => c.trim().toUpperCase()).filter(Boolean);
    if (!codes.length) return res.json([]);
    res.json(await sectionsFor(String(term), codes));
}));

// Suggested courses per program. Hardcoded for now: uOttawa publishes sequences on
// the catalogue pages, and scraping them properly is its own project. These are the
// usual first-year required courses, not the full official sequence (electives are
// left to the student), so check them against the catalogue before relying on them.
// Keep the ids in step with PROGRAMS in client/src/config.ts, which also has their names.
// Each term only lists courses uoCampus actually offers then (checked for 2026-27):
// MAT1348, for one, only runs in the winter.
const SEQUENCES = {
    "cs-year1": {
        fall: ["ITI1120", "MAT1320", "MAT1341"],
        winter: ["ITI1121", "MAT1322", "MAT1348", "ENG1112"],
    },
    // ITI1100 runs in the winter this year, not the fall.
    "seg-year1": {
        fall: ["ITI1120", "MAT1320", "MAT1341", "ENG1112"],
        winter: ["ITI1100", "ITI1121", "MAT1322", "MAT1348", "PHY1122"],
    },
    "ceg-year1": {
        fall: ["ITI1120", "MAT1320", "MAT1341", "PHY1121"],
        winter: ["ITI1100", "ITI1121", "MAT1322", "MAT1348", "PHY1122", "ENG1112"],
    },
    // BIO1130 and BIO1140 were renumbered BIO1131 and BIO1141.
    "bio-year1": {
        fall: ["BIO1131", "CHM1311", "MAT1330"],
        winter: ["BIO1141", "CHM1321", "MAT1332"],
    },
    "psy-year1": {
        fall: ["PSY1101", "SOC1101", "PHI1101"],
        winter: ["PSY1102", "ECO1102", "PHI1101"],
    },
    "eco-year1": {
        fall: ["ECO1104", "SOC1101", "PSY1101"],
        winter: ["ECO1102", "PSY1102", "PHI1101"],
    },
};

app.get("/api/sequences/:program", route(async (req, res) =>
{
    const sequence = SEQUENCES[req.params.program];
    if (!sequence) return res.status(404).json({ error: "Unknown program" });

    const term = (await terms()).find(t => t.id === String(req.query.term));
    const season = /winter|hiver/i.test(term?.name || "") ? "winter" : "fall";
    res.json(sequence[season] || []);
}));

// ---------- Professors ----------

app.get("/api/profs/:name/summary", route(async (req, res) =>
{
    const name = decodeURIComponent(req.params.name);
    res.json(await profSummary(name));
}));

// ---------- Preferences ----------

// Fills in the sliders from the student's sentence. Separate from /api/schedules/ai, which
// still gets the sentence itself when they press Build.
app.post("/api/preferences/parse", route(async (req, res) =>
{
    const { prompt, current } = req.body || {};
    if (!prompt?.trim()) return res.status(400).json({ error: "prompt is required" });
    if (!geminiEnabled()) return res.status(501).json({ error: "The AI isn't configured on this server. Use the sliders instead." });

    const base = { ...DEFAULT_PREFERENCES, ...(current || {}) };
    try
    {
        res.json(await parsePreferences(prompt.slice(0, 2000), base));
    }
    catch (err)
    {
        // Google's own error text is long and technical. Say what happened and what to do.
        console.error("preferences parse failed", err.message);
        const busy = /Gemini 429/.test(err.message);
        res.status(busy ? 429 : 502).json({
            error: busy
                ? "The AI is at its limit for the moment. Try again in a minute, or set the sliders yourself."
                : "Couldn't read your preferences just now. Set them with the sliders instead.",
        });
    }
}));

// ---------- Schedules ----------

// Gemini builds the schedules from the student's prompt and settings (ai/generation.js).
// Without a key, or when Gemini fails or runs out of quota, the generator builds them
// instead, and builtBy tells the UI which one did.
app.post("/api/schedules/generate", route(async (req, res) =>
{
    const { termId, courseCodes = [], preferences, busy = [], prompt = "" } = req.body || {};
    if (!termId) return res.status(400).json({ error: "termId is required" });
    if (!courseCodes.length) return res.json([]);
    if (new Set(courseCodes).size > MAX_COURSES)
    {
        return res.status(400).json({ error: `You can build with up to ${MAX_COURSES} courses at a time. Remove one and try again.` });
    }

    const codes = courseCodes.map(c => String(c).toUpperCase());
    const prefs = { ...DEFAULT_PREFERENCES, ...(preferences || {}) };
    const sections = await sectionsFor(String(termId), codes);
    const profs = await profMap(sections.map(s => s.prof));

    if (geminiEnabled())
    {
        try
        {
            const built = await buildSchedules({
                termId: String(termId),
                courseCodes: codes,
                sections,
                preferences: prefs,
                busy,
                profs,
                prompt: typeof prompt === "string" ? prompt.slice(0, 2000) : "",
            });
            if (built.length) return res.json(built);
        }
        catch (err)
        {
            console.error("Gemini couldn't build a schedule, using the generator:", err.message);
        }
    }

    res.json(generateSchedules({ courseCodes: codes, sections, preferences: prefs, busy, profs })
        .map(s => ({ ...s, builtBy: "generator" })));
}));

app.post("/api/schedules/explain", route(async (req, res) =>
{
    // request: the student's own words from the prompt box, so the write-up can answer them.
    const { schedules = [], preferences, request = "" } = req.body || {};
    if (!schedules.length) return res.json([]);

    const prefs = { ...DEFAULT_PREFERENCES, ...(preferences || {}) };
    const profs = await profMap(schedules.flatMap(s => s.sections).map(s => s.prof));
    const best = [...schedules].sort((a, b) => b.score - a.score)[0];

    const items = schedules.map(schedule =>
    {
        const facts = scheduleFacts(schedule, best, prefs, profs);
        return { scheduleId: schedule.id, facts, fallback: { text: describeSchedule(facts), ...describeDetails(facts) } };
    });

    if (!geminiEnabled()) return res.json(items.map(i => ({ scheduleId: i.scheduleId, ...i.fallback })));
    res.json(await explainSchedules(items, typeof request === "string" ? request : ""));
}));

// Other times for one component, with the rest of the schedule kept as it is.
app.post("/api/schedules/alternatives", route(async (req, res) =>
{
    const { termId, unitKey, schedule, preferences, busy = [] } = req.body || {};
    if (!termId || !unitKey || !schedule) return res.status(400).json({ error: "termId, unitKey and schedule are required" });

    const prefs = { ...DEFAULT_PREFERENCES, ...(preferences || {}) };
    const courseCodes = [...new Set(schedule.sections.map(s => s.courseCode))];
    const sections = await sectionsFor(String(termId), courseCodes);

    const options = alternativesFor({
        unitKey,
        schedule,
        sections,
        allowedStatus: prefs.allowedStatus,
        busy,
    });

    // Score each swap so the student can see whether it helps or hurts.
    const profs = await profMap([...sections, ...schedule.sections].map(s => s.prof));
    const kept = schedule.sections.filter(s => `${s.courseCode}|${s.sectionCode}` !== unitKey);
    const w = prefs.weights;
    const total = (w.prof + w.time + w.gaps) || 1;

    res.json(options.map(option =>
    {
        const breakdown = scoreBreakdown([...kept, ...option.sections], prefs, profs);
        const score = Math.round(((breakdown.prof * w.prof + breakdown.time * w.time + breakdown.gaps * w.gaps) / total) * 100);
        return { ...option, score, delta: score - schedule.score };
    }).sort((a, b) => b.score - a.score));
}));

// Gemini builds the timetable itself from the sections and ratings, and every answer is
// checked against the section and overlap rules in code before it's returned.
// The planner UI uses /generate above; this one is its own experiment. See docs/api.md.
app.use("/api/schedules/ai", aiScheduleRouter);

// ---------- Google Calendar ----------

app.get("/api/calendar/status", (req, res) => res.json({
    configured: calendarEnabled(),
    signedIn: Boolean(req.user),
}));

app.post("/api/calendar/push", requireUser, route(async (req, res) =>
{
    if (!calendarEnabled()) return res.status(501).json({ error: "Google Calendar isn't configured on this server." });

    const { schedule, term } = req.body || {};
    if (!schedule?.sections?.length || !term?.startDate || !term?.endDate)
    {
        return res.status(400).json({ error: "schedule and term are required" });
    }

    try
    {
        const result = await pushSchedule({ userId: req.user.sub, schedule, term, calendarName: APP_NAME });
        res.json(result);
    }
    catch (err)
    {
        if (err.code === "NO_GOOGLE") return res.status(409).json({ error: err.message, code: "NO_GOOGLE" });
        if (err.code === "GOOGLE_PERMISSION")
        {
            return res.status(403).json({ error: "Google hasn't granted calendar access. Sign out and sign back in to approve it.", code: "GOOGLE_PERMISSION" });
        }
        throw err;
    }
}));

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

app.listen(PORT, () =>
{
    console.log(`${APP_NAME} API on http://localhost:${PORT}`);
    console.log(`  course data: ${useSample() ? "sample" : "live uoCampus"}`);
    console.log(`  gemini:      ${geminiEnabled() ? "on" : "off (set GEMINI_API_KEY)"}`);
    console.log(`  auth0:       ${authEnabled() ? "on" : "off (set AUTH0_DOMAIN and AUTH0_AUDIENCE)"}`);
    console.log(`  calendar:    ${calendarEnabled() ? "on" : "off (set AUTH0_M2M_CLIENT_ID and AUTH0_M2M_CLIENT_SECRET)"}`);
});
