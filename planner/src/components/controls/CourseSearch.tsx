import { useEffect, useState } from "react"
import { PlusIcon, SparklesIcon, XIcon } from "lucide-react"
import { api } from "@/api/client"
import { PROGRAMS } from "@/config"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { courseColorVar } from "@/lib/colors"
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

  return (
    <div className="grid grid-cols-1 gap-2">
      <Label>Courses</Label>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start bg-card font-normal text-muted-foreground" disabled={!termId}>
            <PlusIcon />
            Add a course
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
          {selected.map((c) => (
            <li key={c.code} className="flex items-center gap-2.5 rounded-md border bg-card py-1.5 pr-1 pl-2.5 text-sm">
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
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Search for courses above, or start from your program's suggested courses.</p>
      )}

      {/* Picking a program adds its courses straight away, then the picker resets. */}
      <Select value="" onValueChange={onAddSequence} disabled={!termId}>
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
