import { useState, useEffect } from "react"
import { open } from "@tauri-apps/plugin-dialog"
import { ArrowUp, ArrowDown, FileJson, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/shared/components/ui/button"
import { Kbd } from "@/shared/components/ui/kbd"
import { Card, CardContent } from "@/shared/components/ui/card"
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
import { codeToLabel } from "@/shared/keycodes"
import { useComboFiles } from "@/combo-file/use-combo-files"
import { toast } from "sonner"
import type { HotkeyBinding } from "@/shared/types"

type HotkeysTabProps = {
  hotkeys: HotkeyBinding[]
  onAddHotkey: () => void
  onDeleteHotkey: (id: string) => void
  onUpdateHotkey: (id: string, hotkey: string) => void
  onUpdatePath: (id: string, path: string) => void
  onMoveHotkeyUp: (id: string) => void
  onMoveHotkeyDown: (id: string) => void
}

export function HotkeysTab({
  hotkeys,
  onAddHotkey,
  onDeleteHotkey,
  onUpdateHotkey,
  onUpdatePath,
  onMoveHotkeyUp,
  onMoveHotkeyDown,
}: HotkeysTabProps) {
  const [capturingId, setCapturingId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { comboFiles } = useComboFiles()

  useEffect(() => {
    if (!capturingId) return

    const handler = (e: KeyboardEvent) => {
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
      const combo = parts.join("+")
      const dup = hotkeys.find((h) => h.id !== capturingId && h.hotkey === combo)
      if (dup) {
        toast.error(`Hotkey already used by "${dup.name}"`)
        return
      }
      onUpdateHotkey(capturingId, combo)
      setCapturingId(null)
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [capturingId, onUpdateHotkey, hotkeys])

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
    <Card size="sm" className="h-full">
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

              {/* Row 2: File path + Browse / Dropdown */}
              <div className="flex items-center gap-2 pl-0.5">
                <FileJson className="size-3.5 shrink-0 text-muted-foreground" />
                {comboFiles.length > 0 ? (
                  <>
                    <Select
                      value={binding.comboPath ?? ""}
                      onValueChange={(path) => path && onUpdatePath(binding.id, path)}
                    >
                      <SelectTrigger className="h-7 flex-1 text-xs min-w-0" onClick={(e) => e.stopPropagation()}>
                        <SelectValue placeholder="Select a combo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {comboFiles.map((file) => (
                          <SelectItem key={file.path} value={file.path}>
                            {file.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  </>
                ) : binding.comboPath ? (
                  <>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span className="flex-1 min-w-0 text-xs text-muted-foreground truncate block">
                            {binding.comboPath}
                          </span>
                        }
                      />
                      <TooltipContent className="max-w-[400px] break-all">
                        {binding.comboPath}
                      </TooltipContent>
                    </Tooltip>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleBrowse(binding.id)
                      }}
                    >
                      Change…
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleBrowse(binding.id)
                    }}
                  >
                    Browse…
                  </Button>
                )}
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

        {hotkeys.length === 1 && !hotkeys[0].comboPath && (
          <p className="text-xs text-muted-foreground">
            Pick a combo file, then press the hotkey in-game to start.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
