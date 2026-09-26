interface Props {
  hasCourses: boolean
}

export function EmptyState({ hasCourses }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center p-6">
      <div className="pointer-events-auto max-w-sm rounded-lg border bg-card/95 p-5 text-center shadow-sm backdrop-blur">
        <p className="font-semibold">{hasCourses ? "Ready when you are" : "Your week shows up here"}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasCourses
            ? "Tell us what matters to you, then build your schedules."
            : "Add the courses you want to take this term. Import your work or practice calendar too, and we'll plan around it."}
        </p>
      </div>
    </div>
  )
}
