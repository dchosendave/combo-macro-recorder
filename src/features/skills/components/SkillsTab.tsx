import { useEffect, useRef, useState } from "react"
import { ArrowDown, ArrowUp, ClipboardPaste, Clock, Copy, GripVertical, Lock, LockOpen, Trash2, Wand2 } from "lucide-react"
import { Switch } from "@/shared/components/ui/switch"
import { Label } from "@/shared/components/ui/label"
import { Input } from "@/shared/components/ui/input"
import { Button } from "@/shared/components/ui/button"
import { Card, CardContent } from "@/shared/components/ui/card"
import { Separator } from "@/shared/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select"
import { Textarea } from "@/shared/components/ui/textarea"
import { RepeatModeControl } from "@/shared/components/RepeatModeControl"
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

  const scrollRef = useRef<HTMLDivElement>(null)
  const justAddedRef = useRef(false)

  useEffect(() => {
    if (scrollRef.current && justAddedRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      justAddedRef.current = false
    }
  }, [steps.length])

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
      if (locked || !selectedId) return
      if (e.key === "Delete") {
        e.preventDefault()
        onRemoveStep(selectedId)
        setSelectedId(null)
      } else if (e.ctrlKey && e.key === "d") {
        e.preventDefault()
        onDuplicateStep(selectedId)
      } else if (e.ctrlKey && e.key === "ArrowUp") {
        e.preventDefault()
        onMoveStepUp(selectedId)
      } else if (e.ctrlKey && e.key === "ArrowDown") {
        e.preventDefault()
        onMoveStepDown(selectedId)
      }
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
          <div className="flex flex-1 flex-col gap-3 min-h-0 animate-in fade-in-0 slide-in-from-top-2 duration-200">
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
                    onClick={handleAddKeydown}
                    className="gap-1 animate-in fade-in-0 duration-200"
                  >
                    <ArrowDown className="size-3" />
                    KeyDown
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddKeyup}
                    className="gap-1 animate-in fade-in-0 duration-200"
                  >
                    <ArrowUp className="size-3" />
                    KeyUp
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddDelay}
                    className="gap-1 animate-in fade-in-0 duration-200"
                  >
                    <Clock className="size-3" />
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
                              <Button size="icon" variant="ghost" className="size-8 animate-in fade-in-0 duration-200" aria-label="Import from Jitbit">
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
                        onClick={() => {
                          if (locked) return
                          setSelectedId((prev) => (prev === step.id ? null : step.id))
                        }}
                        onDragOver={(e) => handleRowDragOver(e, step.id)}
                        onDrop={(e) => handleRowDrop(e, step.id)}
                        onDragEnd={clearDrag}
                        className={`flex flex-1 cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-2 transition-colors animate-in fade-in-0 slide-in-from-left-2 duration-200 ${
                          draggingId === step.id ? "opacity-50" : ""
                        } ${
                          dragOverId === step.id
                            ? dropPosition === "above"
                              ? "border-t-2 border-t-primary transition-all duration-150"
                              : "border-b-2 border-b-primary transition-all duration-150"
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
                    : "No steps yet. Add KeyDown, KeyUp, or Delay steps above."}
                </p>
              )}
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
    </Card>
  )
}
