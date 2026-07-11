import { useState } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { open } from "@tauri-apps/plugin-dialog"
import { FolderSearch, Plus, Trash2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { codeToLabel, type HotkeyBinding } from "@/lib/settings"

type HotkeysTabProps = {
  hotkeys: HotkeyBinding[]
  onAddHotkey: () => void
  onDeleteHotkey: (id: string) => void
  onRenameHotkey: (id: string, name: string) => void
  onUpdateHotkey: (id: string, hotkey: string) => void
  onUpdatePath: (id: string, path: string) => void
}

export function HotkeysTab({
  hotkeys,
  onAddHotkey,
  onDeleteHotkey,
  onRenameHotkey,
  onUpdateHotkey,
  onUpdatePath,
}: HotkeysTabProps) {
  const [capturingId, setCapturingId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [alwaysOnTop, setAlwaysOnTop] = useState(false)

  const toggleAlwaysOnTop = async (v: boolean) => {
    setAlwaysOnTop(v)
    await getCurrentWindow().setAlwaysOnTop(v)
  }

  const handleKeyCapture = (e: React.KeyboardEvent) => {
    if (!capturingId) return
    e.preventDefault()
    if (e.key === "Escape") {
      setCapturingId(null)
      return
    }
    if (e.code) {
      onUpdateHotkey(capturingId, e.code)
    }
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
      <CardContent className="flex flex-col gap-3 overflow-y-auto">
        <div className="flex flex-col gap-2">
          {hotkeys.map((binding) => (
            <div
              key={binding.id}
              onClick={() => setSelectedId(binding.id)}
              className={`flex flex-col gap-2 rounded-xl border px-3 py-2 transition-colors cursor-pointer ${
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
                <span className="text-xs text-muted-foreground truncate">
                  {binding.comboPath
                    ? binding.comboPath.split(/[\\/]/).pop()
                    : "No file selected"}
                </span>
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
      </CardContent>
    </Card>
  )
}
