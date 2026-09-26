import { useMemo } from "react"
import { CalendarRangeIcon, Loader2Icon, MoonIcon, RefreshCwIcon, SunIcon, TriangleAlertIcon } from "lucide-react"
import { MotionConfig } from "motion/react"
import { AccountButton } from "@/components/auth/AccountButton"
import { CourseSearch } from "@/components/controls/CourseSearch"
import { PreferencePanel } from "@/components/controls/PreferencePanel"
import { PromptBox } from "@/components/controls/PromptBox"
import { TermSelect } from "@/components/controls/TermSelect"
import { CalendarActions } from "@/components/ics/CalendarActions"
import { EmptyState } from "@/components/schedule/EmptyState"
import { Explanation } from "@/components/schedule/Explanation"
import { ScheduleTabs } from "@/components/schedule/ScheduleTabs"
import { SwapDialog } from "@/components/schedule/SwapDialog"
import { WeekGrid } from "@/components/schedule/WeekGrid"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Toaster } from "@/components/ui/sonner"
import { APP_NAME } from "@/config"
import { usePlanner } from "@/hooks/usePlanner"
import { findConflicts } from "@/lib/conflicts"

export default function App() {
  const p = usePlanner()
  const courseOrder = p.courses.map((c) => c.code)
  const sections = p.active?.sections ?? []
  const conflicts = useMemo(() => findConflicts(sections, p.busy), [sections, p.busy])

  return (
    <MotionConfig reducedMotion="user">
      {/* On a laptop the page never scrolls: only the controls column does, and the
          schedule fills the rest. On a phone there isn't room for that, so the page
          scrolls normally and the grid keeps a usable minimum height. */}
      <div className="flex min-h-svh flex-col lg:h-svh lg:overflow-hidden">
        <Header />

        <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 px-4 pb-4 lg:grid-cols-[350px_minmax(0,1fr)] lg:gap-6 lg:px-6">
          {/* Controls. This is the one scrolling region. */}
          <aside className="flex flex-col rounded-xl border lg:min-h-0 lg:overflow-hidden">
            <div className="flex flex-col gap-6 p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              <TermSelect terms={p.terms} value={p.termId} onChange={p.changeTerm} />
              <CourseSearch
                termId={p.termId}
                selected={p.courses}
                onAdd={p.addCourse}
                onRemove={p.removeCourse}
                onAddSequence={p.addSequence}
              />
              <Separator />
              <PromptBox
                value={p.prompt}
                onChange={p.setPrompt}
                onSubmit={p.readPrompt}
                parsing={p.parsing}
                parseCount={p.parseCount}
                preferences={p.preferences}
                available={p.health?.gemini ?? true}
              />
              <PreferencePanel value={p.preferences} onChange={p.setPreferences} animateKey={p.parseCount} />
            </div>

            <div className="shrink-0 border-t p-3">
              <Button
                className="w-full"
                size="lg"
                onClick={p.generate}
                disabled={p.generating || p.courses.length === 0}
              >
                {p.generating ? <Loader2Icon className="animate-spin" /> : <CalendarRangeIcon />}
                {p.generating
                  ? "Building your schedules"
                  : p.schedules.length
                    ? "Rebuild my schedules"
                    : "Build my schedules"}
              </Button>
            </div>
          </aside>

          {/* Schedule. Fills the rest of the screen, nothing scrolls. */}
          <section className="flex min-w-0 flex-col gap-3 lg:min-h-0" aria-label="Schedules">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
              <ScheduleTabs schedules={p.schedules} activeId={p.activeId} onChange={p.setActiveId} />
              <div className="ml-auto">
                <CalendarActions
                  term={p.term}
                  active={p.active}
                  hasContent={p.schedules.length > 0 || p.busy.length > 0}
                  googleCalendarReady={Boolean(p.health?.googleCalendar)}
                  onImport={p.importBusy}
                  onClear={p.clearAll}
                />
              </div>
            </div>

            {p.outdated && !p.generating && (
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-1.5 text-sm">
                <span className="text-muted-foreground">Your settings changed since these were built.</span>
                <Button size="sm" variant="secondary" onClick={p.generate}>
                  <RefreshCwIcon />
                  Rebuild
                </Button>
              </div>
            )}

            {conflicts.size > 0 && (
              <p className="flex shrink-0 items-center gap-1.5 text-sm text-destructive" role="status">
                <TriangleAlertIcon className="size-4" />
                Classes outlined in red overlap with something else in your week.
              </p>
            )}

            <div className="relative flex min-h-[28rem] flex-col lg:min-h-0 lg:flex-1">
              <WeekGrid
                sections={sections}
                busy={p.busy}
                courseOrder={courseOrder}
                conflicts={conflicts}
                profs={p.profs}
                onLoadProf={p.loadProf}
                onSwap={p.active ? p.openSwap : undefined}
                dimmed={p.generating}
              />

              {p.generating && (
                <div className="absolute inset-0 z-30 grid place-items-center">
                  <div className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm shadow-sm">
                    <Loader2Icon className="size-4 animate-spin" />
                    Trying every combination
                  </div>
                </div>
              )}

              {!p.generating && p.schedules.length === 0 && <EmptyState hasCourses={p.courses.length > 0} />}
            </div>

            {p.active && (
              <div className="shrink-0">
                <Explanation
                  schedule={p.active}
                  text={p.explanations[p.active.id]}
                  loading={p.explaining}
                  courseCount={p.courses.length}
                />
              </div>
            )}
          </section>
        </main>

        <SwapDialog
          open={Boolean(p.swapKey)}
          onOpenChange={(open) => !open && p.closeSwap()}
          unitKey={p.swapKey}
          current={p.swapCurrent}
          options={p.swapOptions}
          onPick={p.applySwap}
        />
      </div>

      <Toaster position="bottom-center" />
    </MotionConfig>
  )
}

function Header() {
  const { theme, setTheme } = useTheme()
  const isDark =
    theme === "dark" ||
    (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  return (
    <header className="flex shrink-0 items-center justify-between gap-4 px-4 py-3 lg:px-6">
      <div className="flex items-baseline gap-3">
        <h1 className="text-xl font-extrabold tracking-tight">{APP_NAME}</h1>
        <p className="hidden text-sm text-muted-foreground md:block">
          Build your uOttawa schedule around the profs and times you want.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <AccountButton />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </Button>
      </div>
    </header>
  )
}
