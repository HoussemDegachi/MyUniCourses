// All app state in one place. Components read from this and call its actions.
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { api, ApiError } from "@/api/client"
import { MAX_COURSES, SHOWN_SCHEDULES } from "@/config"
import type { ImportResult } from "@/lib/ics"
import { prereqNote, prereqText } from "@/lib/prerequisites"
import type {
  Alternative,
  BusyBlock,
  Course,
  Explanation,
  Health,
  Preferences,
  Prof,
  Schedule,
  Term,
} from "@/types"

export const DEFAULT_PREFERENCES: Preferences = {
  earliestStart: null,
  latestEnd: null,
  daysOff: [],
  freeTimes: [],
  allowedStatus: ["OPEN", "WAITLIST"],
  weights: { prof: 50, time: 50, gaps: 50 },
  notes: [],
}

// What the page remembers across a refresh. Bump the version when this shape changes,
// so an old save is ignored rather than loaded into the wrong shape.
const STORAGE_KEY = "uschedule-state-v1"

interface Saved {
  termId: string
  courses: Course[]
  preferences: Preferences
  prompt: string
  busy: BusyBlock[]
  schedules: Schedule[]
  activeId: string
  explanations: Record<string, Explanation>
  generatedKey: string | null
}

const NOTHING_SAVED: Saved = {
  termId: "",
  courses: [],
  preferences: DEFAULT_PREFERENCES,
  prompt: "",
  busy: [],
  schedules: [],
  activeId: "",
  explanations: {},
  generatedKey: null,
}

// Storage can be blocked or full (private windows, cleared site data). The page works
// the same without it; it just starts fresh.
function loadSaved(): Saved {
  try {
    const saved: Saved = { ...NOTHING_SAVED, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") }
    if (!saved.schedules.some((s) => s.id === saved.activeId)) saved.activeId = saved.schedules[0]?.id ?? ""
    // Free times and notes only ever came from the old Read my preferences button.
    saved.preferences = { ...saved.preferences, freeTimes: [], notes: [] }
    return saved
  } catch {
    return NOTHING_SAVED
  }
}

function save(state: Saved) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Blocked or full. Nothing to do but keep going.
  }
}

export function usePlanner() {
  const [saved] = useState(loadSaved)
  const [health, setHealth] = useState<Health | null>(null)
  const [terms, setTerms] = useState<Term[]>([])
  const [termId, setTermId] = useState(saved.termId)
  const [courses, setCourses] = useState<Course[]>(saved.courses)
  const [preferences, setPreferences] = useState<Preferences>(saved.preferences)
  const [prompt, setPrompt] = useState(saved.prompt)
  const [busy, setBusy] = useState<BusyBlock[]>(saved.busy)
  const [schedules, setSchedules] = useState<Schedule[]>(saved.schedules)
  const [activeId, setActiveId] = useState(saved.activeId)
  const [explanations, setExplanations] = useState<Record<string, Explanation>>(saved.explanations)
  const [generating, setGenerating] = useState(false)
  const [explaining, setExplaining] = useState(false)
  const [profs, setProfs] = useState<Record<string, Prof | null>>({})
  const [generatedKey, setGeneratedKey] = useState<string | null>(saved.generatedKey)
  const [buildId, setBuildId] = useState(0) // bumps on every build, so the grid redraws

  // Swapping one lab or DGD without touching the rest of the week.
  const [swapKey, setSwapKey] = useState<string | null>(null)
  const [swapOptions, setSwapOptions] = useState<Alternative[] | null>(null)

  const profRequests = useRef(new Set<string>())

  const loadProf = useCallback(async (name: string) => {
    if (profRequests.current.has(name)) return
    profRequests.current.add(name)
    try {
      const prof = await api.getProf(name)
      setProfs((prev) => ({ ...prev, [name]: prof }))
    } catch {
      profRequests.current.delete(name)
    }
  }, [])

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null))

    api
      .getTerms()
      .then((list) => {
        setTerms(list)
        if (list.some((t) => t.id === saved.termId)) {
          // Ratings for the profs in the schedules kept from last time, for the hover cards.
          saved.schedules.forEach((s) => s.sections.forEach((x) => x.prof && loadProf(x.prof)))
          return
        }
        // First visit, or the saved term has ended and uoCampus no longer lists it.
        // Start on the first term, without the old term's courses.
        setTermId(list[0]?.id ?? "")
        if (saved.termId) {
          setCourses([])
          setSchedules([])
          setExplanations({})
          setGeneratedKey(null)
        }
      })
      .catch((err) => toast.error(message(err, "Couldn't load terms.")))
  }, [saved, loadProf])

  useEffect(() => {
    save({ termId, courses, preferences, prompt, busy, schedules, activeId, explanations, generatedKey })
  }, [termId, courses, preferences, prompt, busy, schedules, activeId, explanations, generatedKey])

  const term = terms.find((t) => t.id === termId) ?? null

  // Tells the UI when the shown schedules no longer match the current settings.
  const currentKey = JSON.stringify([termId, courses.map((c) => c.code), preferences, busy, prompt.trim()])
  const outdated = schedules.length > 0 && generatedKey !== currentKey

  const changeTerm = useCallback((id: string) => {
    setTermId(id)
    setCourses([])
    setSchedules([])
    setExplanations({})
    setGeneratedKey(null)
  }, [])

  const addCourse = useCallback(
    (c: Course) => {
      if (courses.some((p) => p.code === c.code)) return
      if (courses.length >= MAX_COURSES) {
        toast.error(`You can take up to ${MAX_COURSES} courses at once. Remove one to add ${c.code}.`)
        return
      }
      const next = [...courses, c]
      setCourses(next)
      const note = prereqNote(c, next)
      if (note) toast.warning(prereqText(c, note))
    },
    [courses],
  )

  const removeCourse = useCallback((code: string) => {
    setCourses((prev) => prev.filter((c) => c.code !== code))
  }, [])

  const addSequence = useCallback(
    async (program: string) => {
      if (!termId) return
      try {
        const suggested = await api.getSequence(program, termId)
        if (!suggested.length) {
          toast("No suggested courses for this term yet.")
          return
        }
        const { found } = await findCourses(termId, suggested)
        const { fresh, added, next, notes } = planAdd(courses, found)
        if (!added.length) {
          if (fresh.length) toast.error(`You already have ${MAX_COURSES} courses, the most you can take at once. Remove some first.`)
          else toast(found.length ? "Those courses are already in your list." : "None of those courses are offered this term.")
          return
        }
        setCourses(next)
        toast.success(`Added ${added.length} suggested course${added.length === 1 ? "" : "s"}.`, {
          description: notes.length ? notes.join(" ") : undefined,
        })
      } catch (err) {
        toast.error(message(err, "Couldn't load suggested courses."))
      }
    },
    [termId, courses],
  )

  // request is the student's own words, so the write-up can say whether they got what they asked for.
  const explain = useCallback((list: Schedule[], prefs: Preferences, request: string) => {
    setExplaining(true)
    api
      .explain(list, prefs, request)
      // Merge, don't replace: after swapping one component we only re-explain
      // the schedule that changed, and the other tabs keep their write-ups.
      .then((items: Explanation[]) =>
        setExplanations((prev) => ({ ...prev, ...Object.fromEntries(items.map((e) => [e.scheduleId, e])) })),
      )
      .catch(() => {
        // The schedules are still usable without the write-up, so stay quiet.
      })
      .finally(() => setExplaining(false))
  }, [])

  const generate = useCallback(async () => {
    if (!termId || courses.length === 0) return
    setGenerating(true)
    setExplanations({})

    try {
      // The prompt goes to Gemini as written; it picks the sections with the sliders in mind.
      const text = prompt.trim()
      // Slicing here, not in the view, so Gemini only writes up what is shown.
      const result = (
        await api.generate({
          termId,
          courseCodes: courses.map((c) => c.code),
          preferences,
          busy,
          prompt: text,
        })
      ).slice(0, SHOWN_SCHEDULES)

      setSchedules(result)
      setBuildId((n) => n + 1)
      setActiveId(result[0]?.id ?? "")
      setGeneratedKey(JSON.stringify([termId, courses.map((c) => c.code), preferences, busy, text]))

      if (result.length === 0) {
        toast.error("No schedule fits. Try allowing waitlisted sections, or removing a course.")
        return
      }
      if (health?.gemini && result[0].builtBy === "generator") {
        toast("Gemini couldn't build these this time, so the standard builder did. Try again in a minute.")
      }

      new Set(result.flatMap((s) => s.sections.map((x) => x.prof).filter((p): p is string => Boolean(p)))).forEach(
        loadProf,
      )
      explain(result, preferences, text)
    } catch (err) {
      toast.error(message(err, "Couldn't build schedules."))
    } finally {
      setGenerating(false)
    }
  }, [termId, courses, preferences, prompt, health, busy, loadProf, explain])

  // ---------- Component swapping ----------

  const active = useMemo(() => schedules.find((s) => s.id === activeId) ?? null, [schedules, activeId])

  const openSwap = useCallback(
    async (unitKey: string) => {
      if (!active || !termId) return
      setSwapKey(unitKey)
      setSwapOptions(null)
      try {
        setSwapOptions(await api.alternatives({ termId, unitKey, schedule: active, preferences, busy }))
      } catch (err) {
        setSwapOptions([])
        toast.error(message(err, "Couldn't load other times."))
      }
    },
    [active, termId, preferences, busy],
  )

  const applySwap = useCallback(
    (option: Alternative) => {
      if (!active || !swapKey) return

      const updated: Schedule = {
        ...active,
        sections: [
          ...active.sections.filter((s) => `${s.courseCode}|${s.sectionCode}` !== swapKey),
          ...option.sections,
        ],
        units: [...active.units.filter((u) => u.key !== swapKey), { ...option }],
        score: option.score,
      }

      setSchedules((prev) => prev.map((s) => (s.id === active.id ? updated : s)))
      setSwapKey(null)
      setSwapOptions(null)

      option.sections.forEach((s) => s.prof && loadProf(s.prof))
      explain([updated], preferences, prompt.trim())
      toast.success(`Switched to section ${option.sectionCode}.`)
    },
    [active, swapKey, preferences, prompt, loadProf, explain],
  )

  const closeSwap = useCallback(() => {
    setSwapKey(null)
    setSwapOptions(null)
  }, [])

  const swapCurrent = useMemo(
    () => (active && swapKey ? active.sections.filter((s) => `${s.courseCode}|${s.sectionCode}` === swapKey) : []),
    [active, swapKey],
  )

  // ---------- Calendar ----------

  // Classes in the file join the course list. Everything else weekly becomes a busy time.
  const importCalendar = useCallback(
    async ({ blocks, courseCodes, skipped }: ImportResult) => {
      // Importing the same file twice shouldn't stack every block twice.
      const fresh = blocks.filter(
        (b) => !busy.some((x) => x.title === b.title && x.day === b.day && x.start === b.start && x.end === b.end),
      )
      if (fresh.length) setBusy((prev) => [...prev, ...fresh.map((b, i) => ({ ...b, id: `${b.id}-${Date.now()}-${i}` }))])

      let added: Course[] = []
      const notes: string[] = []
      if (courseCodes.length) {
        try {
          const { found, missing } = await findCourses(termId, courseCodes)
          const plan = planAdd(courses, found)
          added = plan.added
          if (added.length) setCourses(plan.next)
          notes.push(...plan.notes)
          if (missing.length) {
            notes.push(`${missing.join(", ")} ${missing.length === 1 ? "isn't" : "aren't"} offered in ${term?.name ?? "this term"}.`)
          }
        } catch (err) {
          notes.push(message(err, "Couldn't look up the classes in that file."))
        }
      }
      if (skipped) notes.push(`Skipped ${skipped} one-time event${skipped === 1 ? "" : "s"}.`)

      const done = [
        added.length > 0 && `Added ${codes(added)} to your courses.`,
        fresh.length > 0 && `Imported ${fresh.length} busy time${fresh.length === 1 ? "" : "s"}.`,
      ].filter(Boolean)
      const description = notes.length ? notes.join(" ") : undefined
      if (done.length) toast.success(done.join(" "), { description })
      else toast("Nothing new to add from that file.", { description })
    },
    [busy, courses, termId, term],
  )

  const clearAll = useCallback(() => {
    setSchedules([])
    setExplanations({})
    setBusy([])
    setActiveId("")
    setGeneratedKey(null)
  }, [])

  return {
    health,
    terms,
    term,
    termId,
    changeTerm,
    courses,
    addCourse,
    removeCourse,
    addSequence,
    preferences,
    setPreferences,
    prompt,
    setPrompt,
    busy,
    importCalendar,
    schedules,
    buildId,
    active,
    activeId,
    setActiveId,
    explanations,
    explaining,
    generating,
    generate,
    outdated,
    profs,
    loadProf,
    clearAll,
    swapKey,
    swapOptions,
    swapCurrent,
    openSwap,
    applySwap,
    closeSwap,
  }
}

function message(err: unknown, fallback: string): string {
  return err instanceof ApiError && err.message ? err.message : fallback
}

// Which of these courses fit: new ones only, in the order given, up to MAX_COURSES.
// notes says what was left out and which need prerequisites, for the caller's message.
function planAdd(current: Course[], incoming: Course[]) {
  const fresh = incoming.filter(
    (c, i) => !current.some((p) => p.code === c.code) && incoming.findIndex((x) => x.code === c.code) === i,
  )
  const room = Math.max(0, MAX_COURSES - current.length)
  const added = fresh.slice(0, room)
  const left = fresh.slice(room)
  const next = [...current, ...added]
  const withPrereqs = added.filter((c) => prereqNote(c, next))
  const notes = [
    left.length > 0 &&
      `${codes(left)} ${left.length === 1 ? "was" : "were"} left out, since ${MAX_COURSES} courses is the most at once.`,
    withPrereqs.length > 0 &&
      `${codes(withPrereqs)} ${withPrereqs.length === 1 ? "has" : "have"} prerequisites. Check the note under each course.`,
  ].filter((n): n is string => Boolean(n))
  return { fresh, added, next, notes }
}

// Each code looked up in the term's catalog, in the order given. missing is what isn't offered.
async function findCourses(termId: string, wanted: string[]) {
  const found = await Promise.all(
    wanted.map(async (code) => (await api.searchCourses(termId, code)).find((c) => c.code === code) ?? null),
  )
  return { found: found.filter((c): c is Course => c !== null), missing: wanted.filter((_, i) => !found[i]) }
}

const codes = (list: Course[]) => list.map((c) => c.code).join(", ")
