import { useState } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { open } from "@tauri-apps/plugin-dialog"
import { ArrowUp, ArrowDown, FileJson, Pencil, Plus, Trash2 } from "lucide-react"
import { Switch } from "@/shared/components/ui/switch"
import { Label } from "@/shared/components/ui/label"
import { Button } from "@/shared/components/ui/button"
import { Kbd } from "@/shared/components/ui/kbd"
import { Card, CardContent } from "@/shared/components/ui/card"
import { Separator } from "@/shared/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip"
import { codeToLabel } from "@/shared/lib/keycodes"
import type { CompactCorner, HotkeyBinding } from "@/shared/lib/types"

type HotkeysTabProps = {
  hotkeys: HotkeyBinding[]
  compactCorner: CompactCorner
  onAddHotkey: () => void
  onDeleteHotkey: (id: string) => void
  onUpdateHotkey: (id: string, hotkey: string) => void
  onUpdatePath: (id: string, path: string) => void
  onMoveHotkeyUp: (id: string) => void
  onMoveHotkeyDown: (id: string) => void
  onSetCompactCorner: (corner: CompactCorner) => void
}

export function HotkeysTab({
  hotkeys,
  compactCorner,
  onAddHotkey,
  onDeleteHotkey,
  onUpdateHotkey,
  onUpdatePath,
  onMoveHotkeyUp,
  onMoveHotkeyDown,
  onSetCompactCorner,
}: HotkeysTabProps) {
  const [capturingId, setCapturingId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [alwaysOnTop, setAlwaysOnTop] = useState(() => {
    return localStorage.getItem("combo-macro-always-on-top") === "true"
  })
  const [autoLoad, setAutoLoad] = useState(() => {
    return localStorage.getItem("combo-macro-auto-load") !== "false"
  })

  const toggleAlwaysOnTop = async (v: boolean) => {
    setAlwaysOnTop(v)
    localStorage.setItem("combo-macro-always-on-top", String(v))
    await getCurrentWindow().setAlwaysOnTop(v)
  }

  const toggleAutoLoad = (v: boolean) => {
    setAutoLoad(v)
    localStorage.setItem("combo-macro-auto-load", String(v))
  }

  const handleKeyCapture = (e: React.KeyboardEvent) => {
    if (!capturingId) return
    e.preventDefault()
    if (e.key === "Escape") {
      setCapturingId(null)
      return
    }
    if (["ControlLeft", "ControlRight", "AltLeft", "AltRight", "ShiftLeft", "ShiftRight", "MetaLeft", "MetaRight"].includes(e.code)) {
      return
    }
    const parts: string[] = []
    if (e.ctrlKey) parts.push("Control")
    if (e.altKey) parts.push("Alt")
    if (e.shiftKey) parts.push("Shift")
    if (e.metaKey) parts.push("Meta")
    parts.push(e.code)
    onUpdateHotkey(capturingId, parts.join("+"))
    setCapturingId(null)
  }

  const handleBrowse = async (bindingId: string) => {
    const path = await open({
      filters: [{ name: "JSON", extensions: ["json"] }],
      multiple: false,
    })
    if (path) {
      onUpdatePath(bindingId, path as string)
    }
  }

  return (
    <Card size="sm" className="h-full" onKeyDown={handleKeyCapture} tabIndex={0}>
      <CardContent className="flex flex-1 flex-col gap-3 min-h-0 overflow-y-auto">
        <div className="flex flex-col gap-1.5">
          {hotkeys.map((binding) => (
            <div
              key={binding.id}
              onClick={() => setSelectedId(binding.id)}
              className={`flex flex-col gap-1.5 rounded-xl border px-2.5 py-1.5 transition-all cursor-pointer ${
                selectedId === binding.id
                  ? "border-primary bg-primary/10 ring-1 ring-primary"
                  : "hover:bg-muted/50"
              }`}
            >
              {/* Row 1: Hotkey + Actions */}
              <div className="flex items-center gap-2">

                {/* Hotkey capture — click the badge to start */}
                {capturingId === binding.id ? (
                  <span className="text-xs font-medium text-primary animate-pulse shrink-0">
                    Press a key...
                  </span>
                ) : (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setCapturingId(binding.id)
                          }}
                          className="shrink-0 flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted cursor-pointer"
                        >
                          <Kbd>{codeToLabel(binding.hotkey)}</Kbd>
                          <Pencil className="size-2.5 text-muted-foreground/50" />
                        </button>
                      }
                    />
                    <TooltipContent>Click to change hotkey</TooltipContent>
                  </Tooltip>
                )}
                {capturingId === binding.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setCapturingId(null)
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                  >
                    Cancel
                  </button>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6"
                          disabled={hotkeys.indexOf(binding) === 0}
                          aria-label="Move hotkey up"
                          onClick={(e) => {
                            e.stopPropagation()
                            onMoveHotkeyUp(binding.id)
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
                          className="size-6"
                          disabled={hotkeys.indexOf(binding) === hotkeys.length - 1}
                          aria-label="Move hotkey down"
                          onClick={(e) => {
                            e.stopPropagation()
                            onMoveHotkeyDown(binding.id)
                          }}
                        >
                          <ArrowDown className="size-3" />
                        </Button>
                      }
                    />
                    <TooltipContent>Move down</TooltipContent>
                  </Tooltip>
                  {hotkeys.length > 1 && (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-6"
                            aria-label="Delete hotkey"
                            onClick={(e) => {
                              e.stopPropagation()
                              onDeleteHotkey(binding.id)
                              if (selectedId === binding.id) setSelectedId(null)
                            }}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        }
                      />
                      <TooltipContent>Delete hotkey</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>

              {/* Row 2: File path + Browse */}
              <div className="flex items-center gap-2 pl-0.5">
                <FileJson className="size-3.5 shrink-0 text-muted-foreground" />
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleBrowse(binding.id)
                  }}
                  className="flex-1 text-left min-w-0"
                >
                  {binding.comboPath ? (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span className="text-xs text-muted-foreground truncate block">
                            {binding.comboPath}
                          </span>
                        }
                      />
                      <TooltipContent className="max-w-[400px] break-all">
                        {binding.comboPath}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-xs text-muted-foreground/60 italic">
                      No file selected
                    </span>
                  )}
                </button>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-6 shrink-0"
                        aria-label="Browse for combo file"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleBrowse(binding.id)
                        }}
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    }
                  />
                  <TooltipContent>Browse...</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onAddHotkey}
          className="gap-1.5"
        >
          <Plus className="size-3.5" />
          Add Hotkey
        </Button>

        <Separator />

        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Window</Label>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="always-on-top-hotkeys" className="font-normal">
            Always on top
          </Label>
          <Switch
            id="always-on-top-hotkeys"
            checked={alwaysOnTop}
            onCheckedChange={toggleAlwaysOnTop}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="auto-load-last" className="font-normal">
            Auto-load last combo on startup
          </Label>
          <Switch
            id="auto-load-last"
            checked={autoLoad}
            onCheckedChange={toggleAutoLoad}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label className="font-normal">Snap compact to</Label>
          <Select value={compactCorner} onValueChange={(v) => onSetCompactCorner(v as CompactCorner)}>
            <SelectTrigger size="sm" className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto (nearest)</SelectItem>
              <SelectItem value="top-right">Top-right</SelectItem>
              <SelectItem value="top-left">Top-left</SelectItem>
              <SelectItem value="bottom-right">Bottom-right</SelectItem>
              <SelectItem value="bottom-left">Bottom-left</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}
