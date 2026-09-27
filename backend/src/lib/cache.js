// Memory cache with a time limit, plus a disk copy so a restart keeps the data.
// The scraper is slow and uoCampus rate limits, so caching is not optional.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DIR = path.join(process.cwd(), ".cache");
const memory = new Map();

function safeName(key)
{
    return key.replace(/[^a-z0-9._-]/gi, "_") + ".json";
}

export async function cached(key, ttlMs, load)
{
    const now = Date.now();
    const hit = memory.get(key);
    if (hit && now - hit.at < ttlMs) return hit.value;

    if (!hit)
    {
        try
        {
            const raw = JSON.parse(await readFile(path.join(DIR, safeName(key)), "utf8"));
            if (now - raw.at < ttlMs)
            {
                memory.set(key, raw);
                return raw.value;
            }
        }
        catch
        {
            // No disk copy yet. Fall through and load it.
        }
    }

    const value = await load();
    const entry = { at: now, value };
    memory.set(key, entry);

    try
    {
        await mkdir(DIR, { recursive: true });
        await writeFile(path.join(DIR, safeName(key)), JSON.stringify(entry));
    }
    catch
    {
        // Disk cache is a nice-to-have. Keep going without it.
    }

    return value;
}

export function peek(key)
{
    return memory.get(key)?.value;
}

export function put(key, value)
{
    memory.set(key, { at: Date.now(), value });
}
