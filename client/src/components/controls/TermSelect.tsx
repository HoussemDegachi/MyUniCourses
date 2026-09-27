import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Term } from "@/types"

interface Props {
  terms: Term[]
  value: string
  onChange: (id: string) => void
}

export function TermSelect({ terms, value, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 gap-2">
      <Label htmlFor="term">Term</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="term" className="w-full bg-card">
          <SelectValue placeholder="Choose a term" />
        </SelectTrigger>
        <SelectContent>
          {terms.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
