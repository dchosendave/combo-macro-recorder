import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Card, CardContent } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type HotkeysTabProps = {
  hotkey: string
  capturing: boolean
  setCapturing: (capturing: boolean | ((prev: boolean) => boolean)) => void
}

export function HotkeysTab({
  hotkey,
  capturing,
  setCapturing,
}: HotkeysTabProps) {
  return (
    <Card size="sm" className="h-full">
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-sm">
            Start / Stop
            <Kbd>{capturing ? "…" : hotkey}</Kbd>
          </span>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCapturing((c) => !c)}
                >
                  {capturing ? "Press a key…" : "Change"}
                </Button>
              }
            />
            <TooltipContent>Click, then press any key</TooltipContent>
          </Tooltip>
        </div>
        <p className="text-xs text-muted-foreground">
          {capturing
            ? "Press any key to bind, or Esc to cancel."
            : "Bind any key to toggle Start / Stop."}
        </p>
      </CardContent>
    </Card>
  )
}
