import { ClipboardPaste, Copy, Eye, EyeOff, Scissors, SlidersHorizontal, Trash2 } from "lucide-react"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Separator } from "@/shared/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/components/ui/sheet"

type StepSelectionInspectorProps = {
  selectedCount: number
  selectedDelayCount: number
  selectedHasEnabledStep: boolean
  clipboardCount: number
  bulkDelay: string
  onBulkDelayChange: (value: string) => void
  onDuplicate: () => void
  onCopy: () => void
  onCut: () => void
  onPaste: () => void
  onToggleDisabled: () => void
  onDelete: () => void
  onAdjustDelay: (operation: "set" | "add" | "subtract") => void
}

export function StepSelectionInspector({
  selectedCount,
  selectedDelayCount,
  selectedHasEnabledStep,
  clipboardCount,
  bulkDelay,
  onBulkDelayChange,
  onDuplicate,
  onCopy,
  onCut,
  onPaste,
  onToggleDisabled,
  onDelete,
  onAdjustDelay,
}: StepSelectionInspectorProps) {
  return (
    <Sheet>
      <div className="flex items-center gap-2 rounded-xl border bg-muted/30 px-2 py-1.5">
        <span className="min-w-0 flex-1 truncate text-xs font-medium">
          {selectedCount > 0 ? `${selectedCount} step${selectedCount === 1 ? "" : "s"} selected` : `${clipboardCount} copied step${clipboardCount === 1 ? "" : "s"}`}
        </span>
        <SheetTrigger render={<Button size="sm" variant="outline" className="h-7" />}>
          <SlidersHorizontal className="size-3" />
          Inspect
        </SheetTrigger>
      </div>

      <SheetContent className="w-full sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Step inspector</SheetTitle>
          <SheetDescription>
            {selectedCount > 0
              ? `Edit ${selectedCount} selected step${selectedCount === 1 ? "" : "s"}. All changes remain undoable.`
              : "Paste the copied steps at the end of the macro."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-6 pb-6">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={selectedCount === 0} onClick={onDuplicate}>
              <Copy /> Duplicate
            </Button>
            <Button variant="outline" disabled={selectedCount === 0} onClick={onCopy}>
              <Copy /> Copy
            </Button>
            <Button variant="outline" disabled={selectedCount === 0} onClick={onCut}>
              <Scissors /> Cut
            </Button>
            <Button variant="outline" disabled={clipboardCount === 0} onClick={onPaste}>
              <ClipboardPaste /> Paste
            </Button>
            <Button variant="outline" disabled={selectedCount === 0} onClick={onToggleDisabled}>
              {selectedHasEnabledStep ? <EyeOff /> : <Eye />}
              {selectedHasEnabledStep ? "Disable" : "Enable"}
            </Button>
            <Button variant="destructive" disabled={selectedCount === 0} onClick={onDelete}>
              <Trash2 /> Delete
            </Button>
          </div>

          {selectedDelayCount > 0 && (
            <>
              <Separator />
              <div className="flex flex-col gap-2">
                <div>
                  <p className="text-sm font-medium">Selected delays</p>
                  <p className="text-xs text-muted-foreground">
                    Apply a millisecond value to {selectedDelayCount} selected delay{selectedDelayCount === 1 ? "" : "s"}.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    inputMode="numeric"
                    value={bulkDelay}
                    onChange={(event) => onBulkDelayChange(event.target.value.replace(/[^0-9]/g, ""))}
                    aria-label="Bulk delay milliseconds"
                  />
                  <span className="text-xs text-muted-foreground">ms</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" onClick={() => onAdjustDelay("set")}>Set</Button>
                  <Button variant="outline" onClick={() => onAdjustDelay("add")}>Add</Button>
                  <Button variant="outline" onClick={() => onAdjustDelay("subtract")}>Subtract</Button>
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
