import { Button } from "@/shared/components/ui/button"
import { Kbd } from "@/shared/components/ui/kbd"
import { formatElapsed } from "@/shared/format"

type CompactOverlayProps = {
  elapsed: number
  activations: number
  potionsActive: boolean
  skillsActive: boolean
  hotkey: string
  profileName: string | null
  onStop: () => void
}

export function CompactOverlay({
  elapsed,
  activations,
  potionsActive,
  skillsActive,
  hotkey,
  profileName,
  onStop,
}: CompactOverlayProps) {
  return (
    <div className="flex h-screen items-center gap-3 px-3">
      <div className="flex items-center gap-2">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex size-2.5 rounded-full bg-green-500" />
        </span>
        <span className="text-sm font-medium transition-opacity">
          {formatElapsed(elapsed)}
        </span>
        {profileName && (
          <span className="text-xs text-muted-foreground">· {profileName}</span>
        )}
        <span className="text-xs text-muted-foreground">
          {activations} cycles
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <span
          className={`size-1.5 rounded-full transition-colors duration-300 ${potionsActive ? "bg-green-400" : "bg-muted-foreground/50"}`}
        />
        <span className="text-xs text-muted-foreground">Potions</span>
        <span
          className={`size-1.5 rounded-full transition-colors duration-300 ${skillsActive ? "bg-green-400" : "bg-muted-foreground/50"}`}
        />
        <span className="text-xs text-muted-foreground">Skills</span>
      </div>

      <div className="flex-1" />

      <Button
        variant="destructive"
        size="xs"
        onClick={onStop}
        className="gap-1.5"
      >
        STOP
        <Kbd>{hotkey}</Kbd>
      </Button>
    </div>
  )
}
