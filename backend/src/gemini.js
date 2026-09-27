// Every Gemini call goes through callGemini here. The API key stays on the server.
//
// The write-ups and prof summaries below only phrase what is already true: anything
// factual is computed in generator.js and passed in, so Gemini never invents a rating,
// time or score. The one place it decides anything is picking the timetable
// (ai/generation.js), and every timetable it picks is checked and scored in code.

import { createHash } from "node:crypto";
import { cached } from "./lib/cache.js";

// The free tier allows gemini-3.8-flash only 20 requests a day, which one demo run can use
// up. flash-lite handles these small jobs just as well. See .env.example.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export const geminiEnabled = () => Boolean(process.env.GEMINI_API_KEY);

// The one way this backend talks to Gemini. A schema gets JSON back in that shape, and
// json alone asks for JSON of any shape. A setting left null uses the model's default.
export async function callGemini({
    system,
    user,
    schema,
    json = Boolean(schema),
    temperature = 0.2,
    thinking = "low",
    maxOutputTokens = 8192,
    timeout = 30000,
})
{
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not set");

    const config = {
        temperature,
        // Gemini 3 models think before answering, and that thinking counts against
        // maxOutputTokens. At 1024 the JSON came back cut off mid-string.
        maxOutputTokens,
        thinkingConfig: thinking ? { thinkingLevel: thinking } : null,
        responseMimeType: json ? "application/json" : null,
        responseSchema: schema || null,
    };
    const body = JSON.stringify({
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: Object.fromEntries(Object.entries(config).filter(([, v]) => v != null)),
    });

    for (let attempt = 1; ; attempt++)
    {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        let res;
        let raw;
        try
        {
            // Key in a header rather than the URL, so it never shows up in a logged URL.
            res = await fetch(ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-goog-api-key": key },
                body,
                signal: controller.signal,
            });
            raw = await res.text();
        }
        finally
        {
            clearTimeout(timer);
        }

        // 503 means the model is busy right now, not that the request is wrong.
        if (res.status === 503 && attempt < 3)
        {
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            continue;
        }
        if (!res.ok) throw new Error(`Gemini ${res.status}: ${errorMessage(raw)}`);

        const data = JSON.parse(raw);
        const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("").trim();
        if (!text) throw new Error("Gemini returned nothing");
        if (!json) return text;
        // Strip a stray code fence in case the model adds one anyway.
        return JSON.parse(text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, ""));
    }
}

function errorMessage(raw)
{
    try
    {
        return JSON.parse(raw).error?.message || raw.slice(0, 300);
    }
    catch
    {
        return raw.slice(0, 300);
    }
}

// ---------- Professor summaries ----------

const PROF_SYSTEM = `You summarize student reviews of a university professor for another student choosing a section.

Rules:
- Two or three sentences. Plain language, no marketing tone.
- Only say things the reviews actually support. Never invent a number, a course or a policy.
- Mention what teaching is like, how grading feels, and anything that changes how a student should prepare.
- Cover the negative points as well as the positive ones. Do not smooth over criticism.
- Never use the professor's name as a subject of praise or blame. Describe the teaching, not the person.
- Never mention appearance, personality or anything unrelated to teaching.`;

export async function summarizeProf(name, reviews)
{
    if (!reviews.length) return null;
    const sample = reviews.slice(0, 25).map(r => `- ${r.course ? `[${r.course}] ` : ""}${r.comment}`).join("\n");
    return callGemini({
        system: PROF_SYSTEM,
        user: `Professor: ${name}\n\nReviews:\n${sample}`,
        temperature: 0.3,
    });
}

// ---------- Schedule explanations ----------

const EXPLAIN_SYSTEM = `You analyse a class schedule for a student: what it gives them, and what it costs them.

You are given facts already computed from the schedule. Use only those facts.
- Never state a number, time, professor rating or day that is not in the facts.
- Speak to the student as "you". Plain language, no greetings, no headings.
- summary: two or three sentences. Lead with what the schedule gives them, then the biggest trade-off.
  If it is not the best option, say plainly what it gives up compared with comparedWithBest.
- strengths: two to four short sentences, each one specific thing that is good about this week.
  Use the week breakdown, professors, preferences kept and open seats.
- tradeoffs: two to four short sentences, each one specific cost: long days (longestDay), waiting between
  classes, early or late classes, low-rated or hard professors, waitlisted sections, missed preferences.
  If there is genuinely nothing to give up, return an empty list rather than inventing one.
- If courses could not be placed, include that in tradeoffs, naming which and why, using only the reason and
  conflictsWith given for each. NOT_OFFERED: not offered this term. FULL: every section is full.
  WAITLIST_ONLY: only waitlisted sections are left. BUSY: every section overlaps the busy times named.
  CLASH: it overlaps the courses named in this schedule.
- "studentRequest", when present, is what the student asked for in their own words. Say in the summary
  whether this schedule gives them that. If a class sits in time they wanted free (freeTimesMissed),
  name it in tradeoffs.`;

const EXPLAIN_SCHEMA = {
    type: "object",
    properties: {
        summary: { type: "string" },
        strengths: { type: "array", items: { type: "string" } },
        tradeoffs: { type: "array", items: { type: "string" } },
    },
    required: ["summary", "strengths", "tradeoffs"],
};

const EXPLAIN_TTL = 7 * 24 * 60 * 60 * 1000;

const cleanList = v => (Array.isArray(v) ? v.filter(x => typeof x === "string" && x.trim()).map(x => x.trim()).slice(0, 4) : null);

// item.fallback is { text, strengths, tradeoffs } built without the AI. Any part the
// model leaves out or garbles falls back to it, so the panel is never half empty.
// request is the student's own words from the prompt box, so the write-up can answer
// them directly ("Friday afternoon stays free" or "MAT1721 still meets Friday at 14:30").
export async function explainSchedules(items, request = "")
{
    const studentRequest = String(request || "").trim().slice(0, 1000);
    return Promise.all(items.map(async item =>
    {
        try
        {
            const input = studentRequest ? { facts: item.facts, studentRequest } : item.facts;
            // Same facts and request, same write-up. Rebuilding or switching back to a schedule
            // costs no quota, which matters on the free tier. A failed call throws and is never cached.
            const key = `explain-${createHash("sha1").update(JSON.stringify(input)).digest("hex")}`;
            const out = await cached(key, EXPLAIN_TTL, () => callGemini({
                system: EXPLAIN_SYSTEM,
                user: JSON.stringify(input),
                schema: EXPLAIN_SCHEMA,
                temperature: 0.4,
            }));
            return {
                scheduleId: item.scheduleId,
                text: typeof out.summary === "string" && out.summary.trim() ? out.summary.trim() : item.fallback.text,
                strengths: cleanList(out.strengths) ?? item.fallback.strengths,
                tradeoffs: cleanList(out.tradeoffs) ?? item.fallback.tradeoffs,
            };
        }
        catch
        {
            return { scheduleId: item.scheduleId, ...item.fallback };
        }
    }));
}
