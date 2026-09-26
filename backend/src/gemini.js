// Every Gemini call lives here. The API key stays on the server.
//
// Rule for these prompts: Gemini reads the user's words and writes sentences.
// It never invents ratings, times or scores. Anything factual is computed in
// generator.js and passed in, so the model can only phrase what is already true.

const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export const geminiEnabled = () => Boolean(process.env.GEMINI_API_KEY);

async function callGemini({ system, user, schema, temperature = 0.2 })
{
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not set");

    const body = {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
            temperature,
            maxOutputTokens: 1024,
            ...(schema ? { responseMimeType: "application/json", responseSchema: schema } : {}),
        },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try
    {
        const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);

        const data = await res.json();
        const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("").trim();
        if (!text) throw new Error("Gemini returned nothing");
        return schema ? JSON.parse(text) : text;
    }
    finally
    {
        clearTimeout(timeout);
    }
}

// ---------- Preferences ----------

const PREFERENCE_SCHEMA = {
    type: "object",
    properties: {
        earliestStart: { type: "string", nullable: true, description: "24h HH:MM, or null for no preference" },
        latestEnd: { type: "string", nullable: true, description: "24h HH:MM, or null for no preference" },
        daysOff: { type: "array", items: { type: "string", enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT"] } },
        allowWaitlist: { type: "boolean" },
        weights: {
            type: "object",
            properties: {
                prof: { type: "number" },
                time: { type: "number" },
                gaps: { type: "number" },
            },
            required: ["prof", "time", "gaps"],
        },
        notes: { type: "array", items: { type: "string" } },
    },
    required: ["daysOff", "allowWaitlist", "weights", "notes"],
};

const PREFERENCE_SYSTEM = `You turn a student's description of their ideal class schedule into settings.

Rules:
- Only change what the student actually mentions. Keep every other value exactly as given in "current".
- weights are 0 to 100. 0 means the student does not care, 100 means it is their top priority.
  prof = wanting higher-rated professors.
  time = wanting classes inside their preferred hours and days.
  gaps = wanting classes close together with little idle time.
- If they say one thing matters more than another, raise that weight to about 85 and lower the other to about 30.
- earliestStart is the earliest a class may begin. latestEnd is the latest a class may end.
- "no classes before 10" means earliestStart "10:00". "done by 4" means latestEnd "16:00".
- daysOff are days they want completely free.
- allowWaitlist is false only if they say they want to avoid waitlists.
- notes: at most two short sentences about anything you could not put into a field, written to the student
  as plain advice. Use an empty array when there is nothing. Never restate the fields.
- Never invent a preference they did not express.`;

export async function parsePreferences(prompt, current)
{
    const parsed = await callGemini({
        system: PREFERENCE_SYSTEM,
        user: `current: ${JSON.stringify(current)}\n\nstudent says: ${prompt}`,
        schema: PREFERENCE_SCHEMA,
    });

    const clamp = (n, fallback) => (typeof n === "number" && Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : fallback);
    const time = v => (typeof v === "string" && /^\d{1,2}:\d{2}$/.test(v) ? v.padStart(5, "0") : null);
    const days = Array.isArray(parsed.daysOff) ? parsed.daysOff.filter(d => ["MON", "TUE", "WED", "THU", "FRI", "SAT"].includes(d)) : [];

    return {
        earliestStart: parsed.earliestStart === undefined ? current.earliestStart : time(parsed.earliestStart),
        latestEnd: parsed.latestEnd === undefined ? current.latestEnd : time(parsed.latestEnd),
        daysOff: days,
        allowedStatus: parsed.allowWaitlist === false ? ["OPEN"] : ["OPEN", "WAITLIST"],
        weights: {
            prof: clamp(parsed.weights?.prof, current.weights.prof),
            time: clamp(parsed.weights?.time, current.weights.time),
            gaps: clamp(parsed.weights?.gaps, current.weights.gaps),
        },
        notes: (Array.isArray(parsed.notes) ? parsed.notes : []).slice(0, 2).map(String),
    };
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

const EXPLAIN_SYSTEM = `You explain to a student why a class schedule suits them, and what it costs them.

You are given facts already computed from the schedule. Use only those facts.
- Never state a number, time, professor rating or day that is not in the facts.
- Two or three sentences. Speak to the student as "you".
- Lead with what the schedule gives them, then name the real trade-off.
- If the schedule scores below the top option, say plainly what it gives up.
- If courses could not be placed, say so.
- No greetings, no headings, no bullet points.`;

export async function explainSchedules(items)
{
    const results = await Promise.all(items.map(async item =>
    {
        try
        {
            const text = await callGemini({
                system: EXPLAIN_SYSTEM,
                user: JSON.stringify(item.facts),
                temperature: 0.4,
            });
            return { scheduleId: item.scheduleId, text };
        }
        catch
        {
            return { scheduleId: item.scheduleId, text: item.fallback };
        }
    }));
    return results;
}
