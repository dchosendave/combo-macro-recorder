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
}

export function StartupDialog({ open, onOpen, onNew }: StartupDialogProps) {
  function handleOpenChange(dialogOpen: boolean) {
    if (!dialogOpen) return
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Welcome to Combo Macro Recorder</DialogTitle>
          <DialogDescription>
            Load an existing combo file or start a new one.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-start">
          <Button size="sm" onClick={onOpen} className="gap-1.5">
            <FolderOpen className="size-4" />
            Open combo…
          </Button>
          <Button size="sm" variant="outline" onClick={onNew} className="gap-1.5">
            <FilePlus className="size-4" />
            New (untitled)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
