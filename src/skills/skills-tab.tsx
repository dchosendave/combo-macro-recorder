import { useEffect, useRef, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { open } from "@tauri-apps/plugin-dialog"
import { AlertTriangle, ArrowDown, ArrowUp, Circle, Clock, Copy, FolderOpen, GripVertical, Lock, LockOpen, Square, Trash2, Undo2, Redo2, Wand2 } from "lucide-react"
import { Switch } from "@/shared/components/ui/switch"
import { Label } from "@/shared/components/ui/label"
import { Input } from "@/shared/components/ui/input"
import { Button } from "@/shared/components/ui/button"
import { Slider } from "@/shared/components/ui/slider"
import { Card, CardContent } from "@/shared/components/ui/card"
import { Separator } from "@/shared/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select"
import { RepeatModeControl } from "@/shared/components/repeat-mode-control"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog"
import { toast } from "sonner"
import { type RepeatMode, type SkillStep, type StepLabelStyle } from "@/shared/types"
import { parseCombo, parseJitbitFile } from "@/skills/parsers"
import { useRecorder } from "@/recorder/use-recorder"
import { SkillKeyPicker } from "@/skills/skill-key-picker"
import { analyzeSkillSteps } from "@/shared/skill-keys"
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert"
import { adjustSelectedDelays, copySelectedSteps, duplicateSelectedSteps, pasteSkillSteps, reorderSelectedSteps, setSelectedStepsDisabled } from "@/skills/step-selection"
import { SkillTimeline } from "@/skills/skill-timeline"
import { StepSelectionInspector } from "@/skills/step-selection-inspector"
import { normalizePlaybackSpeed } from "@/shared/run-validation"

type SkillsTabProps = {
  enabled: boolean
  setEnabled: (value: boolean) => void
  steps: SkillStep[]
  onSetSteps: (steps: SkillStep[]) => void
  onAddKeydown: () => void
  onAddKeyup: () => void
  onAddDelay: () => void
  onRemoveStep: (id: string) => void
  onMoveStepUp: (id: string) => void
  onMoveStepDown: (id: string) => void
  onDuplicateStep: (id: string) => void
  onUpdateStep: (id: string, patch: { key?: string; ms?: string }) => void
  labelStyle: StepLabelStyle
  setLabelStyle: (style: StepLabelStyle) => void
  holdRightClick: boolean
  setHoldRightClick: (v: boolean) => void
  repeatMode: RepeatMode
  setRepeatMode: (mode: RepeatMode) => void
  repeatCount: string
  setRepeatCount: (value: string) => void
  playbackSpeed: string
  setPlaybackSpeed: (value: string) => void
  repeatError: boolean
  keyError: boolean
  unmatchedKeydowns: string[]
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onRecordedSteps?: (steps: SkillStep[]) => void
  /** Whether a combo file is currently open — steers the empty-state hint toward recording/opening when none is. */
  hasComboFile?: boolean
  activeRunStepIndex?: number | null
  runnerActive?: boolean
}

export function SkillsTab({
  enabled,
  setEnabled,
  steps,
  onSetSteps,
  onAddKeydown,
  onAddKeyup,
  onAddDelay,
  onRemoveStep,
  onMoveStepUp,
  onMoveStepDown,
  onDuplicateStep,
  onUpdateStep,
  labelStyle,
  setLabelStyle,
  holdRightClick,
  setHoldRightClick,
  repeatMode,
  setRepeatMode,
  repeatCount,
  setRepeatCount,
  playbackSpeed,
  setPlaybackSpeed,
  repeatError,
  keyError,
  unmatchedKeydowns,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onRecordedSteps,
  hasComboFile,
  activeRunStepIndex = null,
  runnerActive = false,
}: SkillsTabProps) {
  const [comboKeys, setComboKeys] = useState("")
  const [comboDelays, setComboDelays] = useState("")
  const [comboOpen, setComboOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [stepClipboard, setStepClipboard] = useState<SkillStep[]>([])
  const selectionAnchorRef = useRef<string | null>(null)
  const [locked, setLocked] = useState(true)
  const [bulkDelay, setBulkDelay] = useState("10")
  const [editorView, setEditorView] = useState<"list" | "timeline">(
    () => localStorage.getItem("combo-macro-skill-editor-view") === "timeline" ? "timeline" : "list",
  )
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dropPosition, setDropPosition] = useState<"above" | "below">("below")

  const scrollRef = useRef<HTMLDivElement>(null)
  const justAddedRef = useRef(false)

  const { isRecording, countdown, startRecording, stopRecording, cancelCountdown } = useRecorder()
  const invalidStepIds = new Set(analyzeSkillSteps(steps).invalidStepIds)
  const selectedDelayCount = steps.filter((step) => selectedIds.has(step.id) && step.type === "delay").length
  const selectedHasEnabledStep = steps.some((step) => selectedIds.has(step.id) && !step.disabled)
  const activeRunStepId = activeRunStepIndex === null
    ? null
    : steps.filter((step) => !step.disabled)[activeRunStepIndex]?.id ?? null
  const effectivePlaybackSpeed = normalizePlaybackSpeed(playbackSpeed)
  const authoredDurationMs = steps.reduce(
    (total, step) => total + (step.type === "delay" && !step.disabled ? Math.max(0, Number(step.ms) || 0) : 0),
    0,
  )
  const effectiveDurationMs = Math.round(authoredDurationMs / effectivePlaybackSpeed)

  const deleteSelection = () => {
    if (selectedIds.size === steps.length) {
      setShowClearConfirm(true)
      return
    }
    onSetSteps(steps.filter((step) => !selectedIds.has(step.id)))
    setSelectedIds(new Set())
  }

  const duplicateSelection = () => {
    const result = duplicateSelectedSteps(steps, selectedIds)
    onSetSteps(result.steps)
    setSelectedIds(result.selectedIds)
  }

  const copySelection = () => {
    const copied = copySelectedSteps(steps, selectedIds)
    if (copied.length > 0) setStepClipboard(copied)
  }

  const cutSelection = () => {
    const copied = copySelectedSteps(steps, selectedIds)
    if (copied.length === 0) return
    setStepClipboard(copied)
    onSetSteps(steps.filter((step) => !selectedIds.has(step.id)))
    setSelectedIds(new Set())
  }

  const pasteClipboard = () => {
    const result = pasteSkillSteps(steps, stepClipboard, selectedIds)
    if (result.steps === steps) return
    onSetSteps(result.steps)
    setSelectedIds(result.selectedIds)
  }

  const applyBulkDelay = (operation: "set" | "add" | "subtract") => {
    const amount = Math.max(0, Number(bulkDelay) || 0)
    onSetSteps(adjustSelectedDelays(steps, selectedIds, amount, operation))
  }

  const toggleSelectionDisabled = () => {
    onSetSteps(setSelectedStepsDisabled(steps, selectedIds, selectedHasEnabledStep))
  }

  const selectStep = (id: string, modifiers: { toggle: boolean; range: boolean }) => {
    if (locked) return
    if (modifiers.range && selectionAnchorRef.current) {
      const anchor = steps.findIndex((step) => step.id === selectionAnchorRef.current)
      const current = steps.findIndex((step) => step.id === id)
      const [start, end] = anchor < current ? [anchor, current] : [current, anchor]
      setSelectedIds(new Set(steps.slice(start, end + 1).map((step) => step.id)))
    } else if (modifiers.toggle) {
      setSelectedIds((selected) => {
        const next = new Set(selected)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
      selectionAnchorRef.current = id
    } else {
      setSelectedIds(new Set([id]))
      selectionAnchorRef.current = id
    }
  }

  useEffect(() => {
    if (scrollRef.current && justAddedRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      justAddedRef.current = false
    }
  }, [steps.length])

  useEffect(() => {
    if (!activeRunStepId || editorView !== "list") return
    scrollRef.current
      ?.querySelector<HTMLElement>(`[data-step-id="${activeRunStepId}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [activeRunStepId, editorView])

  // Discard selections that no longer exist, and clear selection when locked.
  useEffect(() => {
    const existing = new Set(steps.map((step) => step.id))
    setSelectedIds((selected) => locked ? new Set() : new Set([...selected].filter((id) => existing.has(id))))
  }, [locked, steps])

  const handleAddKeydown = () => {
    justAddedRef.current = true
    onAddKeydown()
  }
  const handleAddKeyup = () => {
    justAddedRef.current = true
    onAddKeyup()
  }
  const handleAddDelay = () => {
    justAddedRef.current = true
    onAddDelay()
  }

  const clearDrag = () => {
    setDraggingId(null)
    setDragOverId(null)
  }

  const handleStepListKeyDown = (e: React.KeyboardEvent) => {
    if (locked) return
    if (e.key === "Delete") {
      e.preventDefault()
      if (selectedIds.size === 0) return
      deleteSelection()
    } else if (e.ctrlKey && e.key === "d") {
      e.preventDefault()
      if (selectedIds.size === 0) return
      duplicateSelection()
    } else if (e.ctrlKey && e.key === "ArrowUp") {
      e.preventDefault()
      moveSelection(-1)
    } else if (e.ctrlKey && e.key === "ArrowDown") {
      e.preventDefault()
      moveSelection(1)
    }
  }

  const handleGlobalKeyDown = (e: React.KeyboardEvent) => {
    if (editorView !== "list") return
    const target = e.target as HTMLElement
    const isEditable = target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement
      || target.isContentEditable
    if (isEditable) return
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      e.preventDefault()
      onUndo()
    } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
      e.preventDefault()
      onRedo()
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      e.preventDefault()
      if (!locked) copySelection()
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x") {
      e.preventDefault()
      if (!locked) cutSelection()
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
      e.preventDefault()
      if (!locked) pasteClipboard()
    } else if ((e.ctrlKey || e.metaKey) && e.key === "a") {
      e.preventDefault()
      if (!locked) {
        setSelectedIds(new Set(steps.map((step) => step.id)))
      }
    }
  }

  const moveSelection = (direction: -1 | 1) => {
    if (selectedIds.size === 0) return
    const indexes = steps.map((step, index) => selectedIds.has(step.id) ? index : -1).filter((index) => index >= 0)
    const boundary = direction < 0 ? Math.min(...indexes) : Math.max(...indexes)
    const neighbor = boundary + direction
    if (neighbor < 0 || neighbor >= steps.length || selectedIds.has(steps[neighbor].id)) return
    reorderSelection(steps[neighbor].id, direction < 0 ? "above" : "below")
  }

  const reorderSelection = (toId: string, position: "above" | "below") => {
    if (selectedIds.has(toId) || selectedIds.size === 0) return
    onSetSteps(reorderSelectedSteps(steps, selectedIds, toId, position))
  }

  const handleRowDragOver = (e: React.DragEvent<HTMLDivElement>, stepId: string) => {
    if (!draggingId || draggingId === stepId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    const rect = e.currentTarget.getBoundingClientRect()
    const isAbove = e.clientY < rect.top + rect.height / 2
    setDragOverId(stepId)
    setDropPosition(isAbove ? "above" : "below")
  }

  const handleRowDrop = (e: React.DragEvent<HTMLDivElement>, stepId: string) => {
    e.preventDefault()
    if (draggingId) reorderSelection(stepId, dropPosition)
    clearDrag()
  }

  const labelText = (type: SkillStep["type"]) => {
    if (labelStyle === "icon") {
      return type === "keydown" ? "↓" : type === "keyup" ? "↑" : "⏱"
    }
    return type === "keydown" ? "KD" : type === "keyup" ? "KU" : "DL"
  }

  const handleJitbitFileImport = async () => {
    try {
      const path = await open({
        filters: [{ name: "Jitbit Macro", extensions: ["mcr"] }],
        multiple: false,
      })
      if (!path) return
      const content = await invoke<string>("read_jitbit_file", { path: path as string })
      const result = parseJitbitFile(content)
      if ("rejected" in result) {
        toast.error(
          `Rejected at line ${result.rejected.line}: "${result.rejected.text}" — ${result.rejected.reason}`,
        )
        return
      }
      if (result.steps.length === 0) {
        toast.error("No valid steps found in file")
        return
      }
      onSetSteps(result.steps)
      toast.success(`Imported ${result.steps.length} steps from Jitbit file`)
    } catch (e) {
      toast.error(`Import failed: ${e}`)
    }
  }

  const handleComboGenerate = () => {
    if (!comboKeys.trim()) return
    const generated = parseCombo(comboKeys, comboDelays)
    if (generated.length === 0) {
      toast.error("No valid steps generated")
      return
    }
    onSetSteps(generated)
    setComboOpen(false)
    toast.success(`Generated ${generated.length} steps`)
  }

  return (
    <Card size="sm" className="h-full min-w-0 w-full" onKeyDown={handleGlobalKeyDown} tabIndex={0}>
      <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="enable-skills" className="font-normal">
            Enable skills channel
          </Label>
          <Switch
            id="enable-skills"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        {enabled ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 animate-in fade-in-0 slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="hold-right-click" className="font-normal">
                Hold right mouse button
              </Label>
              <Switch
                id="hold-right-click"
                checked={holdRightClick}
                onCheckedChange={setHoldRightClick}
              />
            </div>

            {/* Row 1: Labels, actions, and lock */}
            <div className="flex items-center gap-1.5">
              {editorView === "list" && (
                <>
                  <span className="text-xs text-muted-foreground">Labels:</span>
                  <Select value={labelStyle} onValueChange={(v) => setLabelStyle(v as StepLabelStyle)}>
                    <SelectTrigger className="h-7 w-[120px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                  <SelectItem value="abbreviation">KD / KU / DL</SelectItem>
                  <SelectItem value="icon">↓ / ↑ / ⏱</SelectItem>
                </SelectContent>
              </Select>
                </>
              )}

              <span className="text-xs text-muted-foreground">View:</span>
              <Select value={editorView} onValueChange={(value) => {
                if (!value) return
                const view = value as "list" | "timeline"
                setEditorView(view)
                localStorage.setItem("combo-macro-skill-editor-view", view)
              }}>
                <SelectTrigger className="h-7 w-[105px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="list">List view</SelectItem>
                  <SelectItem value="timeline">Timeline</SelectItem>
                    </SelectContent>
                  </Select>

              <div className="flex-1" />

              {!locked && editorView === "list" && (
                <>
                  <Dialog open={comboOpen} onOpenChange={setComboOpen}>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <DialogTrigger
                            render={
                              <Button size="icon" variant="ghost" className="size-8 animate-in fade-in-0 duration-200" aria-label="Quick combo">
                                <Wand2 className="size-3.5" />
                              </Button>
                            }
                          />
                        }
                      />
                      <TooltipContent>Quick combo generator</TooltipContent>
                    </Tooltip>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Quick Combo Generator</DialogTitle>
                        <DialogDescription>
                          Enter keys and delays to auto-generate a keydown/delay/keyup sequence.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1.5">
                          <Label className="text-xs">Keys (comma-separated)</Label>
                          <Input
                            value={comboKeys}
                            onChange={(e) => setComboKeys(e.target.value)}
                            placeholder="1,2,3"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label className="text-xs">Delays (comma-separated)</Label>
                          <Input
                            value={comboDelays}
                            onChange={(e) => setComboDelays(e.target.value)}
                            placeholder="85,45,60,150"
                          />
                          <p className="text-xs text-muted-foreground">
                            For 3 keys like "1,2,3", "85,45,60,150" means: 85ms after key 1, 45ms after key 2, 60ms before releasing, 150ms rest after the cycle.
                          </p>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button size="sm" onClick={handleComboGenerate}>
                          Generate
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 animate-in fade-in-0 duration-200"
                          aria-label="Import from Jitbit"
                          onClick={() => handleJitbitFileImport()}
                        >
                          <FolderOpen className="size-3.5" />
                        </Button>
                      }
                    />
                    <TooltipContent>Import from Jitbit (.mcr file)</TooltipContent>
                  </Tooltip>
                </>
              )}

              {!locked && editorView === "list" && (
                <>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 animate-in fade-in-0 duration-200"
                          disabled={!canUndo}
                          aria-label="Undo (Ctrl+Z)"
                          onClick={onUndo}
                        >
                          <Undo2 className="size-3.5" />
                        </Button>
                      }
                    />
                    <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 animate-in fade-in-0 duration-200"
                          disabled={!canRedo}
                          aria-label="Redo (Ctrl+Shift+Z)"
                          onClick={onRedo}
                        >
                          <Redo2 className="size-3.5" />
                        </Button>
                      }
                    />
                    <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
                  </Tooltip>
                </>
              )}

              {editorView === "list" ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        aria-label={locked ? "Unlock editing" : "Lock editing"}
                        onClick={() => setLocked((l) => !l)}
                      >
                        {locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
                      </Button>
                    }
                  />
                  <TooltipContent>{locked ? "Unlock editing" : "Lock editing"}</TooltipContent>
                </Tooltip>
              ) : (
                <span className="text-xs text-muted-foreground">Read-only</span>
              )}
            </div>

            {/* Row 2: Add-step buttons (only when unlocked) */}
            {!locked && editorView === "list" && (
              <div className="flex items-center gap-1.5 animate-in fade-in-0 duration-200">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddKeydown}
                  className="gap-1"
                >
                  <ArrowDown className="size-3" />
                  KeyDown
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddKeyup}
                  className="gap-1"
                >
                  <ArrowUp className="size-3" />
                  KeyUp
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddDelay}
                  className="gap-1"
                >
                  <Clock className="size-3" />
                  Delay
                </Button>

                <div className="flex-1" />

                <Button
                  variant={isRecording || countdown !== null ? "destructive" : "outline"}
                  size="sm"
                  onClick={async () => {
                    if (countdown !== null) {
                      cancelCountdown()
                    } else if (isRecording) {
                      const steps = await stopRecording()
                      if (steps && onRecordedSteps) {
                        onRecordedSteps(steps)
                      }
                    } else {
                      startRecording()
                    }
                  }}
                  className="gap-1"
                >
                  {countdown !== null ? (
                    <>
                      <Square className="size-3" />
                      Cancel {countdown}
                    </>
                  ) : isRecording ? (
                    <>
                      <Square className="size-3" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Circle className="size-3 fill-current text-red-500" />
                      Record
                    </>
                  )}
                </Button>
              </div>
            )}

            {!locked && editorView === "list" && (selectedIds.size > 0 || stepClipboard.length > 0) && (
              <StepSelectionInspector
                selectedCount={selectedIds.size}
                selectedDelayCount={selectedDelayCount}
                selectedHasEnabledStep={selectedHasEnabledStep}
                clipboardCount={stepClipboard.length}
                bulkDelay={bulkDelay}
                onBulkDelayChange={setBulkDelay}
                onDuplicate={duplicateSelection}
                onCopy={copySelection}
                onCut={cutSelection}
                onPaste={pasteClipboard}
                onToggleDisabled={toggleSelectionDisabled}
                onDelete={deleteSelection}
                onAdjustDelay={applyBulkDelay}
              />
            )}

            {keyError && (
              <Alert variant="destructive" className="py-2">
                <AlertTriangle />
                <AlertTitle>Choose a supported key</AlertTitle>
                <AlertDescription>Empty or unsupported key steps must be corrected before running.</AlertDescription>
              </Alert>
            )}
            {unmatchedKeydowns.length > 0 && (
              <Alert className="py-2 border-amber-500/40 bg-amber-500/5">
                <AlertTriangle className="text-amber-600" />
                <AlertTitle>Key held without a matching release</AlertTitle>
                <AlertDescription>
                  {unmatchedKeydowns.join(", ")} {unmatchedKeydowns.length === 1 ? "has" : "have"} a KeyDown without a later KeyUp. This is allowed, but verify it is intentional.
                </AlertDescription>
              </Alert>
            )}

            {editorView === "list" ? (
            <div
              ref={scrollRef}
              className="flex-1 min-h-0 overflow-y-auto scroll-smooth"
              onKeyDown={handleStepListKeyDown}
              tabIndex={0}
            >
              {steps.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {steps.map((step, i) => (
                    <div key={step.id} className="flex gap-2">
                      <div className="flex shrink-0 flex-col items-center pt-3">
                        <div
                          className={`w-px flex-1 rounded-full transition-colors ${
                            i === 0 ? "bg-transparent" : "bg-border"
                          }`}
                        />
                        <div
                          className={`mt-0.5 mb-0.5 size-2.5 shrink-0 rounded-full border-2 border-border ${
                            step.type === "keydown"
                              ? "bg-blue-400"
                              : step.type === "keyup"
                                ? "bg-amber-400"
                                : "bg-muted-foreground"
                          }`}
                        />
                        <div
                          className={`w-px flex-1 rounded-full transition-colors ${
                            i === steps.length - 1 ? "bg-transparent" : "bg-border"
                          }`}
                        />
                      </div>
                      <div
                        data-step-row
                        data-step-id={step.id}
                        draggable={!locked}
                        onClick={(event) => {
                          selectStep(step.id, { toggle: event.ctrlKey || event.metaKey, range: event.shiftKey })
                          scrollRef.current?.focus()
                        }}
                        onDragStart={(event) => {
                          const target = event.target as HTMLElement
                          if (target.closest("input, button, textarea, select, [contenteditable='true'], [data-no-row-drag]")) {
                            event.preventDefault()
                            return
                          }
                          if (!selectedIds.has(step.id)) setSelectedIds(new Set([step.id]))
                          setDraggingId(step.id)
                          event.dataTransfer.effectAllowed = "move"
                          event.dataTransfer.setData("text/plain", step.id)
                          event.dataTransfer.setDragImage(event.currentTarget, 12, 12)
                        }}
                        onDragOver={(e) => handleRowDragOver(e, step.id)}
                        onDrop={(e) => handleRowDrop(e, step.id)}
                        onDragEnd={clearDrag}
                        className={`flex flex-1 items-center gap-1.5 rounded-xl border px-3 py-2 transition-colors animate-in fade-in-0 slide-in-from-left-2 duration-200 ${locked ? "cursor-default" : "cursor-grab active:cursor-grabbing"} ${step.disabled ? "opacity-40" : ""} ${activeRunStepId === step.id ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/40" : ""} ${
                          draggingId === step.id ? "opacity-50" : ""
                        } ${
                          dragOverId === step.id
                            ? dropPosition === "above"
                              ? "border-t-2 border-t-primary transition-all duration-150"
                              : "border-b-2 border-b-primary transition-all duration-150"
                            : ""
                        } ${
                          selectedIds.has(step.id)
                            ? "border-primary bg-primary/10 ring-1 ring-primary"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        {!locked && (
                          <span
                            className="flex shrink-0 items-center text-muted-foreground"
                            aria-label="Drag to reorder"
                            title="Drag anywhere on the row to reorder"
                          >
                            <GripVertical className="size-3.5" />
                          </span>
                        )}

                        <span className="w-8 shrink-0 text-center text-xs font-medium text-muted-foreground">
                          {labelText(step.type)}
                        </span>

                        {step.type === "delay" ? (
                          <>
                            <Input
                              inputMode="numeric"
                              value={step.ms}
                              readOnly={locked}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                onUpdateStep(step.id, {
                                  ms: e.target.value.replace(/[^0-9]/g, ""),
                                })
                              }
                              className="h-7 w-20 text-xs"
                            />
                            <span className="text-xs text-muted-foreground">ms</span>
                          </>
                        ) : (
                          <SkillKeyPicker
                            value={step.key}
                            disabled={locked}
                            invalid={invalidStepIds.has(step.id)}
                            onChange={(key) => onUpdateStep(step.id, { key })}
                          />
                        )}

                        <div className="flex-1" />

                        {!locked && (
                          <>
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-6"
                                    disabled={i === 0}
                                    aria-label="Move up"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onMoveStepUp(step.id)
                                    }}
                                  >
                                    <ArrowUp className="size-3" />
                                  </Button>
                                }
                              />
                              <TooltipContent>Move up (Ctrl+↑)</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-6"
                                    disabled={i >= steps.length - 1}
                                    aria-label="Move down"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onMoveStepDown(step.id)
                                    }}
                                  >
                                    <ArrowDown className="size-3" />
                                  </Button>
                                }
                              />
                              <TooltipContent>Move down (Ctrl+↓)</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-6"
                                    aria-label="Duplicate step"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onDuplicateStep(step.id)
                                    }}
                                  >
                                    <Copy className="size-3" />
                                  </Button>
                                }
                              />
                              <TooltipContent>Duplicate (Ctrl+D)</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-6"
                                    aria-label="Remove step"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onRemoveStep(step.id)
                                    }}
                                  >
                                    <Trash2 className="size-3" />
                                  </Button>
                                }
                              />
                              <TooltipContent>Remove (Del)</TooltipContent>
                            </Tooltip>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-2">
                  {locked
                    ? "No steps configured. Unlock to add steps."
                    : hasComboFile
                      ? "No steps yet. Add KeyDown, KeyUp, or Delay steps above."
                      : "No steps yet. Record a combo, or open one from the top bar."}
                </p>
              )}
            </div>
            ) : (
              <SkillTimeline
                steps={steps}
                activeStepId={activeRunStepId}
                playbackSpeed={playbackSpeed}
              />
            )}

            <Separator />

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex w-full items-center justify-between gap-3">
                <Label className="font-normal">Playback speed</Label>
                <span className="min-w-12 text-right text-sm font-medium tabular-nums">
                  {effectivePlaybackSpeed.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}×
                </span>
              </div>
              <span className="text-xs text-muted-foreground">0.1×</span>
              <Slider
                className="min-w-32 flex-1"
                min={0.1}
                max={4}
                step={0.05}
                value={[effectivePlaybackSpeed]}
                disabled={runnerActive}
                aria-label="Playback speed"
                onValueChange={(value) => setPlaybackSpeed(String(typeof value === "number" ? value : value[0]))}
              />
              <span className="text-xs text-muted-foreground">4×</span>
              <Button type="button" variant="ghost" size="xs" disabled={runnerActive || effectivePlaybackSpeed === 1} onClick={() => setPlaybackSpeed("1")}>Reset 1×</Button>
              <span className="basis-full text-xs text-muted-foreground">
                {runnerActive
                  ? "Stop playback to change speed. The current run keeps the speed it started with."
                  : `${authoredDurationMs.toLocaleString()} ms authored · ${effectiveDurationMs.toLocaleString()} ms effective per cycle`}
              </span>
            </div>

            <Separator />

            <RepeatModeControl
              repeatMode={repeatMode}
              setRepeatMode={setRepeatMode}
              repeatCount={repeatCount}
              setRepeatCount={setRepeatCount}
              repeatError={repeatError}
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Turn on to configure skill keys.
          </p>
        )}
      </CardContent>

      <AlertDialog open={showClearConfirm}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all steps?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all {steps.length} steps. Undo (Ctrl+Z) can restore them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowClearConfirm(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                onSetSteps([])
                setShowClearConfirm(false)
                setSelectedIds(new Set())
              }}
            >
              Delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={countdown !== null} onOpenChange={(open) => { if (!open) cancelCountdown() }}>
        <DialogContent className="max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Recording starts in</DialogTitle>
            <DialogDescription>Switch to your target window and get ready.</DialogDescription>
          </DialogHeader>
          <div className="py-4 text-center text-6xl font-semibold tabular-nums text-primary">
            {countdown}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancelCountdown}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
