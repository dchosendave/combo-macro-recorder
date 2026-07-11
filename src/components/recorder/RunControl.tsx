import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"

type RunControlProps = {
  running: boolean
  canRun: boolean
  hotkey: string
  onToggle: () => void
}

export function RunControl({
  running,
  canRun,
  hotkey,
  onToggle,
}: RunControlProps) {
  return (
    <footer className="flex items-center gap-3">
      <Button
        variant={running ? "destructive" : "default"}
        onClick={onToggle}
        disabled={!running && !canRun}
        className="flex-1 gap-2"
      >
        {running ? "STOP" : "START"} <Kbd>{hotkey}</Kbd>
      </Button>
    </footer>
  )
}
