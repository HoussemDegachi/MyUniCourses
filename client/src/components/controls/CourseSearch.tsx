import { useEffect, useState } from "react"
import { InfoIcon, PlusIcon, SparklesIcon, TriangleAlertIcon, XIcon } from "lucide-react"
import { api } from "@/api/client"
import { MAX_COURSES, PROGRAMS } from "@/config"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { courseColorVar } from "@/lib/colors"
import { prereqNote } from "@/lib/prerequisites"
import { cn } from "@/lib/utils"
import type { Course } from "@/types"

interface Props {
  termId: string
  selected: Course[]
  onAdd: (c: Course) => void
  onRemove: (code: string) => void
  onAddSequence: (program: string) => void
}

export function CourseSearch({ termId, selected, onAdd, onRemove, onAddSequence }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Course[]>([])

  useEffect(() => {
    if (!termId || !open) return
    const id = setTimeout(() => {
      api.searchCourses(termId, query).then(setResults).catch(() => setResults([]))
    }, 150)
    return () => clearTimeout(id)
  }, [termId, query, open])

  const codes = selected.map((c) => c.code)
  const full = selected.length >= MAX_COURSES

  return (
    <div className="grid grid-cols-1 gap-2">
      <div className="flex items-baseline justify-between">
        <Label>Courses</Label>
        <span className={cn("text-xs tabular", full ? "font-medium text-foreground" : "text-muted-foreground")}>
          {selected.length} of {MAX_COURSES}
        </span>
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start bg-card font-normal text-muted-foreground" disabled={!termId || full}>
            <PlusIcon />
            {full ? `${MAX_COURSES} courses is the most at once` : "Add a course"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Search by code or title" value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>No courses match that search.</CommandEmpty>
              <CommandGroup>
                {results.map((c) => {
                  const added = codes.includes(c.code)
                  return (
                    <CommandItem
                      key={c.code}
                      value={c.code}
                      disabled={added}
                      onSelect={() => {
                        onAdd(c)
                        setQuery("")
                      }}
                    >
                      <span className="font-semibold tabular">{c.code}</span>
                      <span className="truncate text-muted-foreground">{c.title}</span>
                      {added && <span className="ml-auto text-xs text-muted-foreground">Added</span>}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 ? (
        <ul className="grid grid-cols-1 gap-1.5">
          {selected.map((c) => {
            const note = prereqNote(c, selected)
            return (
              <li key={c.code} className="rounded-md border bg-card py-1.5 pr-1 pl-2.5 text-sm">
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="h-3.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: courseColorVar(c.code, codes) }}
                  />
                  <span className="font-semibold tabular">{c.code}</span>
                  <span className="min-w-0 truncate text-muted-foreground">{c.title}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto size-7 shrink-0"
                    onClick={() => onRemove(c.code)}
                    aria-label={`Remove ${c.code}`}
                  >
                    <XIcon />
                  </Button>
                </div>
                {note && (
                  <p
                    className={cn(
                      "flex items-start gap-1.5 pr-2 pb-0.5 pl-4 text-xs",
                      note.sameTerm.length ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {note.sameTerm.length ? (
                      <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
                    ) : (
                      <InfoIcon className="mt-px size-3.5 shrink-0" />
                    )}
                    {note.sameTerm.length
                      ? `Needs ${note.sameTerm.join(" and ")} passed first. Take it in a later term.`
                      : `Needs ${note.needs.join(", and ")}, passed before this term.`}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Search for courses above, or start from your program's suggested courses.</p>
      )}

      {/* Picking a program adds its courses straight away, then the picker resets. */}
      <Select value="" onValueChange={onAddSequence} disabled={!termId || full}>
        <SelectTrigger size="sm" className="w-full justify-start [&>svg:last-child]:ml-auto" aria-label="Add a program's first-year courses">
          <SparklesIcon className="text-primary" />
          <SelectValue placeholder="Add first-year courses for a program" />
        </SelectTrigger>
        <SelectContent>
          {PROGRAMS.map((prog) => (
            <SelectItem key={prog.id} value={prog.id}>
              {prog.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
