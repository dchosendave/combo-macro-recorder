import { FilePlus, FolderOpen } from "lucide-react"
import { Button } from "@/shared/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog"

type StartupDialogProps = {
  open: boolean
  onOpen: () => void
  onNew: () => void
  onSkip: () => void
}

const HOW_IT_WORKS = [
  "Set your potion and skill keys in the Combo tab.",
  "Save the combo as a file — or record one with the Record button.",
  "Pick that file and assign a hotkey in the Hotkeys tab.",
  "Press the hotkey in-game to start; press it again to stop.",
]

export function StartupDialog({ open, onOpen, onNew, onSkip }: StartupDialogProps) {
  function handleOpenChange(dialogOpen: boolean) {
    if (!dialogOpen) return
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Welcome to Hamin Macro Recorder</DialogTitle>
          <DialogDescription>
            Load an existing combo file or start a new one.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">How it works</p>
          <ol className="flex flex-col gap-1.5 text-xs text-muted-foreground list-decimal list-inside">
            {HOW_IT_WORKS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
        <DialogFooter className="sm:justify-start">
          <Button size="sm" onClick={onOpen} className="gap-1.5">
            <FolderOpen className="size-4" />
            Open combo…
          </Button>
          <Button size="sm" variant="outline" onClick={onNew} className="gap-1.5">
            <FilePlus className="size-4" />
            New (untitled)
          </Button>
          <Button size="sm" variant="ghost" onClick={onSkip} className="ml-auto">
            Skip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
