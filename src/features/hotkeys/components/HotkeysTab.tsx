import { useState } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { open } from "@tauri-apps/plugin-dialog"
import { FolderSearch, ArrowUp, ArrowDown, Plus, Trash2 } from "lucide-react"
import { Switch } from "@/shared/components/ui/switch"
import { Label } from "@/shared/components/ui/label"
import { Input } from "@/shared/components/ui/input"
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
  onRenameHotkey: (id: string, name: string) => void
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
  onRenameHotkey,
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

  const toggleAlwaysOnTop = async (v: boolean) => {
    setAlwaysOnTop(v)
    localStorage.setItem("combo-macro-always-on-top", String(v))
    await getCurrentWindow().setAlwaysOnTop(v)
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
      const binding = hotkeys.find((h) => h.id === bindingId)
      if (binding) {
        const isDefaultName =
          binding.name === "Untitled" || /^Hotkey \d+$/.test(binding.name)
        if (isDefaultName) {
          const basename = (path as string).split(/[\\/]/).pop() ?? ""
          const derived = basename.replace(/\.json$/i, "")
          if (derived) {
            onRenameHotkey(bindingId, derived)
          }
        }
      }
    }
  }

  return (
    <Card size="sm" className="h-full" onKeyDown={handleKeyCapture} tabIndex={0}>
      <CardContent className="flex flex-1 flex-col gap-3 min-h-0 overflow-y-auto">
        <div className="flex flex-col gap-2">
          {hotkeys.map((binding) => (
            <div
              key={binding.id}
              onClick={() => setSelectedId(binding.id)}
              className={`flex flex-col gap-2 rounded-xl border px-3 py-2 transition-all cursor-pointer ${
                selectedId === binding.id
                  ? "border-primary bg-primary/10 ring-1 ring-primary"
                  : "hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <Input
                  value={binding.name}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onRenameHotkey(binding.id, e.target.value)}
                  className="h-7 flex-1 text-sm font-medium"
                />
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6 shrink-0"
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
                        className="size-6 shrink-0"
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
                          className="size-6 shrink-0"
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

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Hotkey:</span>
                {capturingId === binding.id ? (
                  <span className="text-xs font-medium text-primary">Press a key...</span>
                ) : (
                  <Kbd>{codeToLabel(binding.hotkey)}</Kbd>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                    setCapturingId(capturingId === binding.id ? null : binding.id)
                  }}
                >
                  {capturingId === binding.id ? "Cancel" : "Change"}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground shrink-0">File:</span>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span className="text-xs text-muted-foreground truncate">
                        {binding.comboPath
                          ? binding.comboPath.split(/[\\/]/).pop()
                          : "No file selected"}
                      </span>
                    }
                  />
                  <TooltipContent className="max-w-[400px] break-all">
                    {binding.comboPath || "No file selected"}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6 shrink-0"
                        aria-label="Browse for combo file"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleBrowse(binding.id)
                        }}
                      >
                        <FolderSearch className="size-3" />
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
