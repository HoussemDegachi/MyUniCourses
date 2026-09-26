// All app state in one place. Components read from this and call its actions.
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { api, ApiError } from "@/api/client"
import { SHOWN_SCHEDULES } from "@/config"
import type {
  Alternative,
  BusyBlock,
  Course,
  Explanation,
  Health,
  Preferences,
  Prof,
  Schedule,
  Section,
  Term,
} from "@/types"

export const DEFAULT_PREFERENCES: Preferences = {
  earliestStart: null,
  latestEnd: null,
  daysOff: [],
  allowedStatus: ["OPEN", "WAITLIST"],
  weights: { prof: 50, time: 50, gaps: 50 },
  notes: [],
}

export function usePlanner() {
  const [health, setHealth] = useState<Health | null>(null)
  const [terms, setTerms] = useState<Term[]>([])
  const [termId, setTermId] = useState("")
  const [courses, setCourses] = useState<Course[]>([])
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES)
  const [prompt, setPrompt] = useState("")
  const [parsing, setParsing] = useState(false)
  const [parseCount, setParseCount] = useState(0) // bumps after each AI read, animates the sliders
  const [busy, setBusy] = useState<BusyBlock[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [activeId, setActiveId] = useState("")
  const [explanations, setExplanations] = useState<Record<string, string>>({})
  const [generating, setGenerating] = useState(false)
  const [explaining, setExplaining] = useState(false)
  const [profs, setProfs] = useState<Record<string, Prof | null>>({})
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)

  // Swapping one lab or DGD without touching the rest of the week.
  const [swapKey, setSwapKey] = useState<string | null>(null)
  const [swapOptions, setSwapOptions] = useState<Alternative[] | null>(null)

  const profRequests = useRef(new Set<string>())

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null))

    api
      .getTerms()
      .then((list) => {
        setTerms(list)
        if (list[0]) setTermId(list[0].id)
      })
      .catch((err) => toast.error(message(err, "Couldn't load terms.")))
  }, [])

  const term = terms.find((t) => t.id === termId) ?? null

  // Tells the UI when the shown schedules no longer match the current settings.
  const currentKey = JSON.stringify([termId, courses.map((c) => c.code), preferences, busy])
  const outdated = schedules.length > 0 && generatedKey !== currentKey

  const changeTerm = useCallback((id: string) => {
    setTermId(id)
    setCourses([])
    setSchedules([])
    setExplanations({})
    setGeneratedKey(null)
  }, [])

  const addCourse = useCallback((c: Course) => {
    setCourses((prev) => (prev.some((p) => p.code === c.code) ? prev : [...prev, c]))
  }, [])

  const removeCourse = useCallback((code: string) => {
    setCourses((prev) => prev.filter((c) => c.code !== code))
  }, [])

  const addSequence = useCallback(
    async (program: string) => {
      if (!termId) return
      try {
        const codes = await api.getSequence(program, termId)
        if (!codes.length) {
          toast("No suggested courses for this term yet.")
          return
        }
        const found = await Promise.all(codes.map((code) => api.searchCourses(termId, code)))
        const matched = codes
          .map((code) => found.flat().find((c) => c.code === code))
          .filter((c): c is Course => Boolean(c))

        setCourses((prev) => [...prev, ...matched.filter((m) => !prev.some((p) => p.code === m.code))])
        toast.success(`Added ${matched.length} suggested courses.`)
      } catch (err) {
        toast.error(message(err, "Couldn't load suggested courses."))
      }
    },
    [termId],
  )

  const readPrompt = useCallback(async () => {
    if (!prompt.trim()) return
    setParsing(true)
    try {
      setPreferences(await api.parsePreferences(prompt, preferences))
      setParseCount((n) => n + 1)
    } catch (err) {
      toast.error(message(err, "Couldn't read your preferences. Set them with the sliders instead."))
    } finally {
      setParsing(false)
    }
  }, [prompt, preferences])

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

  const explain = useCallback((list: Schedule[], prefs: Preferences) => {
    setExplaining(true)
    api
      .explain(list, prefs)
      // Merge, don't replace: after swapping one component we only re-explain
      // the schedule that changed, and the other tabs keep their write-ups.
      .then((items: Explanation[]) =>
        setExplanations((prev) => ({ ...prev, ...Object.fromEntries(items.map((e) => [e.scheduleId, e.text])) })),
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
      // Slicing here, not in the view, so Gemini only writes up what is shown.
      const result = (
        await api.generate({
          termId,
          courseCodes: courses.map((c) => c.code),
          preferences,
          busy,
        })
      ).slice(0, SHOWN_SCHEDULES)

      setSchedules(result)
      setActiveId(result[0]?.id ?? "")
      setGeneratedKey(currentKey)

      if (result.length === 0) {
        toast.error("No schedule fits. Try allowing waitlisted sections, or removing a course.")
        return
      }

      new Set(result.flatMap((s) => s.sections.map((x) => x.prof).filter((p): p is string => Boolean(p)))).forEach(
        loadProf,
      )
      explain(result, preferences)
    } catch (err) {
      toast.error(message(err, "Couldn't build schedules."))
    } finally {
      setGenerating(false)
    }
  }, [termId, courses, preferences, busy, currentKey, loadProf, explain])

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
      explain([updated], preferences)
      toast.success(`Switched to section ${option.sectionCode}.`)
    },
    [active, swapKey, preferences, loadProf, explain],
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

  const importBusy = useCallback((blocks: BusyBlock[]) => {
    setBusy((prev) => [...prev, ...blocks.map((b, i) => ({ ...b, id: `${b.id}-${Date.now()}-${i}` }))])
  }, [])

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
    parsing,
    parseCount,
    readPrompt,
    busy,
    importBusy,
    schedules,
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

export type Planner = ReturnType<typeof usePlanner>

// Re-exported so App.tsx can show which sections were used.
export type { Section }
