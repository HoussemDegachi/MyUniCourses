import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Schedule } from "@/types"

interface Props {
  schedules: Schedule[]
  activeId: string
  onChange: (id: string) => void
}

export function ScheduleTabs({ schedules, activeId, onChange }: Props) {
  if (schedules.length === 0) return null
  return (
    <Tabs value={activeId} onValueChange={onChange} className="min-w-0 max-w-full">
      <TabsList className="max-w-full justify-start overflow-x-auto">
        {schedules.map((s, i) => (
          <TabsTrigger key={s.id} value={s.id} className="gap-2 px-3">
            {i === 0 ? "Best match" : `Option ${i + 1}`}
            <span className="rounded-sm bg-background/60 px-1 text-xs text-muted-foreground tabular">{s.score}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
