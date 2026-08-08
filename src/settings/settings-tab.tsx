import { useMemo, useState } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { open } from "@tauri-apps/plugin-dialog"
import { FolderOpen, RefreshCw } from "lucide-react"
import { Card, CardContent } from "@/shared/components/ui/card"
import { Label } from "@/shared/components/ui/label"
import { Switch } from "@/shared/components/ui/switch"
import { Button } from "@/shared/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/shared/components/ui/combobox"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select"
import { useComboFiles } from "@/combo-file/use-combo-files"
import { useRunningProcesses } from "@/settings/use-running-processes"
import type { AutoStopConfig, CompactCorner } from "@/shared/types"

const COMBO_DIR_KEY = "combo-macro-combo-dir"

type SettingsTabProps = {
  compactCorner: CompactCorner
  onSetCompactCorner: (corner: CompactCorner) => void
  autoStop: AutoStopConfig
  onSetAutoStop: (value: AutoStopConfig) => void
}

/** App-level preferences: always-on-top, startup auto-load, the combo files directory (shared with the top-bar file switcher), and the compact overlay corner. */
export function SettingsTab({ compactCorner, onSetCompactCorner, autoStop, onSetAutoStop }: SettingsTabProps) {
  const [alwaysOnTop, setAlwaysOnTop] = useState(() => {
    return localStorage.getItem("combo-macro-always-on-top") === "true"
  })
  const [autoLoad, setAutoLoad] = useState(() => {
    return localStorage.getItem("combo-macro-auto-load") !== "false"
  })
  const [comboDir, setComboDir] = useState(() => {
    return localStorage.getItem(COMBO_DIR_KEY) ?? ""
  })
  const { refreshComboFiles } = useComboFiles()
  const { processes, loading, refresh } = useRunningProcesses()

  // Search matches the exe name, window title, or friendly name — users type
  // what they recognize, not necessarily the file name.
  const [processQuery, setProcessQuery] = useState("")
  const filteredProcesses = useMemo(() => {
    const q = processQuery.trim().toLowerCase()
    if (!q) return undefined
    return processes
      .filter((p) =>
        [p.name, p.title, p.friendly].some((field) => field?.toLowerCase().includes(q)),
      )
      .map((p) => p.name)
  }, [processQuery, processes])

  const toggleAlwaysOnTop = async (v: boolean) => {
    setAlwaysOnTop(v)
    localStorage.setItem("combo-macro-always-on-top", String(v))
    await getCurrentWindow().setAlwaysOnTop(v)
  }

  const toggleAutoLoad = (v: boolean) => {
    setAutoLoad(v)
    localStorage.setItem("combo-macro-auto-load", String(v))
  }

  const handleSetComboDir = async () => {
    const selected = await open({ directory: true, multiple: false })
    if (selected) {
      setComboDir(selected as string)
      localStorage.setItem(COMBO_DIR_KEY, selected as string)
      await refreshComboFiles()
    }
  }

  return (
    <Card size="sm" className="h-full">
      <CardContent className="flex flex-1 flex-col gap-3 min-h-0 overflow-y-auto">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Window</Label>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="always-on-top" className="font-normal">
            Always on top
          </Label>
          <Switch
            id="always-on-top"
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
          <Label className="font-normal">
            Combo files directory
          </Label>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs text-muted-foreground truncate max-w-[180px]">
              {comboDir || "Not set"}
            </span>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-6 shrink-0"
                    aria-label="Select directory"
                    onClick={handleSetComboDir}
                  >
                    <FolderOpen className="size-3.5" />
                  </Button>
                }
              />
              <TooltipContent>Select directory</TooltipContent>
            </Tooltip>
            {comboDir && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6 shrink-0"
                      aria-label="Refresh file list"
                      onClick={() => refreshComboFiles()}
                    >
                      <RefreshCw className="size-3.5" />
                    </Button>
                  }
                />
                <TooltipContent>Refresh</TooltipContent>
              </Tooltip>
            )}
          </div>
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

        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">Auto-stop</Label>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="auto-stop" className="font-normal">
            Stop when game loses focus
          </Label>
          <Switch
            id="auto-stop"
            checked={autoStop.enabled}
            onCheckedChange={(v) => onSetAutoStop({ ...autoStop, enabled: v })}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="game-process" className="font-normal">
            Game process name
          </Label>
          <Combobox
            value={autoStop.gameProcess}
            filteredItems={filteredProcesses}
            onValueChange={(v) => onSetAutoStop({ ...autoStop, gameProcess: v ?? "" })}
            onInputValueChange={(v) => {
              setProcessQuery(v)
              onSetAutoStop({ ...autoStop, gameProcess: v })
            }}
            onOpenChange={(open) => {
              if (open) {
                setProcessQuery("")
                refresh()
              }
            }}
            itemToStringLabel={(v) => v}
          >
            <ComboboxInput
              id="game-process"
              placeholder="Pick a process…"
              showClear
              className="w-[190px] text-xs"
            />
            <ComboboxContent>
              <ComboboxList>
                {loading || processes.length === 0 ? (
                  <ComboboxEmpty>{loading ? "Loading processes…" : "No processes found"}</ComboboxEmpty>
                ) : (
                  <>
                    {processes.map((p) => {
                      const primary = p.friendly ?? p.title ?? p.name
                      return (
                        <ComboboxItem key={p.pid} value={p.name}>
                          <span className="truncate">{primary}</span>
                          {primary !== p.name && (
                            <span className="ml-auto max-w-[40%] truncate text-xs font-normal text-muted-foreground">
                              {p.name}
                            </span>
                          )}
                        </ComboboxItem>
                      )
                    })}
                    <ComboboxEmpty>No matching processes</ComboboxEmpty>
                  </>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Stops the macro shortly after you switch away from the game window.
          The game's executable name is matched case-insensitively.
        </p>
      </CardContent>
    </Card>
  )
}
