import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/components/ui/accordion"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog"
import { Kbd } from "@/shared/components/ui/kbd"

type HelpDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-3rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Getting started</DialogTitle>
          <DialogDescription>
            A quick reference for creating, editing, and safely running your macros.
          </DialogDescription>
        </DialogHeader>

        <Accordion defaultValue={["create"]}>
          <AccordionItem value="create">
            <AccordionTrigger>Creating and saving combos</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Configure potion keys and skill steps in the Combo tab, then save the combo from the
              file menu in the header. Saving creates a recovery backup of the previous version.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="record">
            <AccordionTrigger>Recording with a countdown</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Use Record in the Skills editor to capture key presses and delays. The countdown gives
              you time to focus the target window; its duration can be changed in Settings. Cancel
              before capture if you are not ready.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="edit">
            <AccordionTrigger>Editing the list and timeline</AccordionTrigger>
            <AccordionContent className="space-y-2 text-muted-foreground">
              <p>
                List view is best for precise step editing. Timeline view shows the timing and order
                of the same steps; changing either view updates the same combo.
              </p>
              <p>
                Select a step normally, hold <Kbd>Ctrl</Kbd> to toggle individual steps, or hold{" "}
                <Kbd>Shift</Kbd> to select a range. <Kbd>Ctrl+A</Kbd> selects every step. Selected
                delays can be set, increased, or decreased together.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="hotkeys">
            <AccordionTrigger>Hotkeys and run modes</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Assign a saved combo to a global shortcut in Hotkeys. Toggle alternates between start
              and stop; Hold runs only while pressed; Start only and Stop only perform one action;
              Cycle advances through an ordered list of combo files.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="safety">
            <AccordionTrigger>Stopping safely</AccordionTrigger>
            <AccordionContent className="space-y-2 text-muted-foreground">
              <p>
                Configure an emergency-stop shortcut in Settings if you want an independent way to
                stop playback or cancel recording. It is intentionally unset by default.
              </p>
              <p>
                Fix blocking validation errors before running. An unmatched key-down is a warning:
                add the corresponding key-up unless holding that key is intentional.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="recovery">
            <AccordionTrigger>Backup and recovery</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Combo files are saved atomically. If the main file cannot be read and a valid backup
              exists, the app offers to recover it. Recovery replaces the damaged primary file with
              the backup after you confirm.
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  )
}
