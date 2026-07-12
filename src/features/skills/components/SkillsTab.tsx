import { useState } from "react"
import { ArrowDown, ArrowUp, ClipboardPaste, Copy, GripVertical, Lock, LockOpen, Plus, Trash2, Wand2 } from "lucide-react"
import { Switch } from "@/shared/components/ui/switch"
import { Label } from "@/shared/components/ui/label"
import { Input } from "@/shared/components/ui/input"
import { Button } from "@/shared/components/ui/button"
import { Card, CardContent } from "@/shared/components/ui/card"
import { Separator } from "@/shared/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/shared/components/ui/toggle-group"
import { Textarea } from "@/shared/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip"
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
import { MAX_REPEAT } from "@/shared/lib/defaults"
import { type RepeatMode, type SkillStep, type StepLabelStyle } from "@/shared/lib/types"
import { parseCombo, parseJitbit } from "@/features/skills/lib/parsers"

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
  repeatError: boolean
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
  repeatError,
}: SkillsTabProps) {
  const [jitbitText, setJitbitText] = useState("")
  const [jitbitOpen, setJitbitOpen] = useState(false)
  const [comboKeys, setComboKeys] = useState("")
  const [comboDelays, setComboDelays] = useState("")
  const [comboOpen, setComboOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [locked, setLocked] = useState(true)

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dropPosition, setDropPosition] = useState<"above" | "below">("below")

  const clearDrag = () => {
    setDraggingId(null)
    setDragOverId(null)
  }

  const reorderStep = (fromId: string, toId: string, position: "above" | "below") => {
    if (fromId === toId) return
    const from = steps.findIndex((s) => s.id === fromId)
    if (from < 0) return
    const next = [...steps]
    const [moved] = next.splice(from, 1)
    const toIdx = next.findIndex((s) => s.id === toId)
    if (toIdx < 0) return
    next.splice(position === "below" ? toIdx + 1 : toIdx, 0, moved)
    onSetSteps(next)
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
    if (draggingId) reorderStep(draggingId, stepId, dropPosition)
    clearDrag()
  }

  const labelText = (type: SkillStep["type"]) => {
    if (labelStyle === "icon") {
      return type === "keydown" ? "↓" : type === "keyup" ? "↑" : "⏱"
    }
    return type === "keydown" ? "KD" : type === "keyup" ? "KU" : "DL"
  }

  const handleJitbitParse = () => {
    if (!jitbitText.trim()) return
    const parsed = parseJitbit(jitbitText)
    if (parsed.length === 0) {
      toast.error("No valid steps found in pasted text")
      return
    }
    onSetSteps(parsed)
    setJitbitOpen(false)
    setJitbitText("")
    toast.success(`Imported ${parsed.length} steps from Jitbit`)
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
    <Card size="sm" className="h-full">
      <CardContent className="flex flex-1 flex-col gap-3 min-h-0">
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
          <>
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

            <div className="flex items-center gap-1.5">
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

              {!locked && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onAddKeydown}
                    className="gap-1"
                  >
                    <Plus className="size-3" />
                    KeyDown
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onAddKeyup}
                    className="gap-1"
                  >
                    <Plus className="size-3" />
                    KeyUp
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onAddDelay}
                    className="gap-1"
                  >
                    <Plus className="size-3" />
                    Delay
                  </Button>
                </>
              )}

              <div className="flex-1" />

              {!locked && (
                <>
                  <Dialog open={comboOpen} onOpenChange={setComboOpen}>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <DialogTrigger
                            render={
                              <Button size="icon" variant="ghost" className="size-8" aria-label="Quick combo">
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
                          <Label className="text-xs">Delays (comma-separated): between presses, before releases, rest</Label>
                          <Input
                            value={comboDelays}
                            onChange={(e) => setComboDelays(e.target.value)}
                            placeholder="85,45,60,150"
                          />
                          <p className="text-xs text-muted-foreground">
                            Delays: between KeyDowns → before KeyUps → rest after cycle
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

                  <Dialog open={jitbitOpen} onOpenChange={setJitbitOpen}>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <DialogTrigger
                            render={
                              <Button size="icon" variant="ghost" className="size-8" aria-label="Import from Jitbit">
                                <ClipboardPaste className="size-3.5" />
                              </Button>
                            }
                          />
                        }
                      />
                      <TooltipContent>Import from Jitbit</TooltipContent>
                    </Tooltip>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Import from Jitbit Macro Recorder</DialogTitle>
                        <DialogDescription>
                          Paste your Jitbit macro script below.
                        </DialogDescription>
                      </DialogHeader>
                      <Textarea
                        value={jitbitText}
                        onChange={(e) => setJitbitText(e.target.value)}
                        placeholder={`Keyboard : D1 : KeyDown\nDELAY : 85\nKeyboard : D2 : KeyDown\nDELAY : 45\n...`}
                        rows={10}
                        className="font-mono text-xs"
                      />
                      <DialogFooter>
                        <Button size="sm" onClick={handleJitbitParse}>
                          Parse & Import
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </>
              )}

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
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {steps.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {steps.map((step, i) => (
                    <div
                      key={step.id}
                      data-step-row
                      onClick={() =>
                        setSelectedId((prev) => (prev === step.id ? null : step.id))
                      }
                      onDragOver={(e) => handleRowDragOver(e, step.id)}
                      onDrop={(e) => handleRowDrop(e, step.id)}
                      onDragEnd={clearDrag}
                      className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1 transition-colors ${
                        draggingId === step.id ? "opacity-50" : ""
                      } ${
                        dragOverId === step.id
                          ? dropPosition === "above"
                            ? "border-t-2 border-t-primary"
                            : "border-b-2 border-b-primary"
                          : ""
                      } ${
                        selectedId === step.id
                          ? "border-primary bg-primary/10 ring-1 ring-primary"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      {!locked && (
                        <span
                          draggable
                          onDragStart={(e) => {
                            setDraggingId(step.id)
                            e.dataTransfer.effectAllowed = "move"
                            e.dataTransfer.setData("text/plain", step.id)
                            const row = (e.currentTarget.closest("[data-step-row]") ??
                              e.currentTarget) as HTMLElement
                            e.dataTransfer.setDragImage(row, 12, 12)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="flex shrink-0 cursor-grab items-center text-muted-foreground active:cursor-grabbing"
                          aria-label="Drag to reorder"
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
                      <Input
                        value={step.key}
                        readOnly={locked}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          onUpdateStep(step.id, {
                            key: e.target.value.slice(-1),
                          })
                        }
                        placeholder="Key"
                        maxLength={1}
                        className="h-7 w-12 text-center text-xs uppercase"
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
                            className="size-4"
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
                      <TooltipContent>Move up</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-4"
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
                      <TooltipContent>Move down</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-4"
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
                      <TooltipContent>Duplicate</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-4"
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
                      <TooltipContent>Remove step</TooltipContent>
                    </Tooltip>
                      </>
                    )}
                  </div>
                ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-2">
                  {locked
                    ? "No steps configured. Unlock to add steps."
                    : "No steps yet. Add KeyDown, KeyUp, or Delay steps above."}
                </p>
              )}
            </div>

            <Separator />

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
                    className="w-20"
                  />
                )}
              </div>
              {repeatMode === "count" && (
                <p
                  className={`text-xs ${repeatError ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {repeatError ? "Minimum is 1." : "How many times to repeat."}
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Turn on to configure skill keys.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
