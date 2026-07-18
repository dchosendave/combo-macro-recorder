import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/shared/components/ui/toggle-group"
import { MAX_REPEAT } from "@/shared/defaults"
import type { RepeatMode } from "@/shared/types"

type RepeatModeControlProps = {
  repeatMode: RepeatMode
  setRepeatMode: (mode: RepeatMode) => void
  repeatCount: string
  setRepeatCount: (value: string) => void
  repeatError: boolean
}

export function RepeatModeControl({
  repeatMode,
  setRepeatMode,
  repeatCount,
  setRepeatCount,
  repeatError,
}: RepeatModeControlProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="font-normal">Repeat mode</Label>
      <div className="flex items-center gap-2">
        <ToggleGroup
          value={[repeatMode]}
          onValueChange={(v) => {
            const next = v[0] as RepeatMode | undefined
            if (next) setRepeatMode(next)
          }}
          variant="outline"
        >
          <ToggleGroupItem value="loop">Loop</ToggleGroupItem>
          <ToggleGroupItem value="count">Repeat N</ToggleGroupItem>
        </ToggleGroup>
        {repeatMode === "count" && (
          <Input
            inputMode="numeric"
            aria-invalid={repeatError}
            value={repeatCount}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^0-9]/g, "")
              setRepeatCount(
                digits !== "" && Number(digits) > MAX_REPEAT
                  ? String(MAX_REPEAT)
                  : digits,
              )
            }}
            placeholder="1"
            className="w-20 animate-in fade-in-0 slide-in-from-left-2 duration-200"
          />
        )}
      </div>
      {repeatMode === "count" && (
        <p
          className={`text-xs animate-in fade-in-0 duration-200 ${repeatError ? "text-destructive" : "text-muted-foreground"}`}
        >
          {repeatError ? "Minimum is 1." : "How many times to repeat."}
        </p>
      )}
    </div>
  )
}
