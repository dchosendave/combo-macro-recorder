import { useEffect, useMemo, useState } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { open } from "@tauri-apps/plugin-dialog"
import { FolderOpen, RefreshCw, ShieldAlert, X } from "lucide-react"
import { toast } from "sonner"
import { Label } from "@/shared/components/ui/label"
import { Switch } from "@/shared/components/ui/switch"
import { Button } from "@/shared/components/ui/button"
import { Kbd } from "@/shared/components/ui/kbd"
import { Input } from "@/shared/components/ui/input"
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
import { codeToLabel, codeToShortcut } from "@/shared/keycodes"
import type { AutoStopConfig, CompactCorner, HotkeyBinding } from "@/shared/types"
import { RECORD_COUNTDOWN_KEY } from "@/recorder/use-recorder"

const COMBO_DIR_KEY = "combo-macro-combo-dir"

type SettingsTabProps = {
  compactCorner: CompactCorner
  onSetCompactCorner: (corner: CompactCorner) => void
  autoStop: AutoStopConfig
  onSetAutoStop: (value: AutoStopConfig) => void
  emergencyHotkey: string
  onSetEmergencyHotkey: (value: string) => void
  profileHotkeys: HotkeyBinding[]
}

/** App-level preferences: always-on-top, startup auto-load, the combo files directory (shared with the top-bar file switcher), and the compact overlay corner. */
export function SettingsTab({ compactCorner, onSetCompactCorner, autoStop, onSetAutoStop, emergencyHotkey, onSetEmergencyHotkey, profileHotkeys }: SettingsTabProps) {
  const [capturingEmergency, setCapturingEmergency] = useState(false)
  const [recordCountdown, setRecordCountdown] = useState(() => {
    const saved = Number(localStorage.getItem(RECORD_COUNTDOWN_KEY) ?? "3")
    return String(Number.isFinite(saved) ? Math.min(60, Math.max(1, Math.round(saved))) : 3)
  })
  const countdownPreset = ["3", "5", "10"].includes(recordCountdown) ? recordCountdown : "custom"
  const updateRecordCountdown = (value: string) => {
    const seconds = String(Math.min(60, Math.max(1, Number(value) || 1)))
    setRecordCountdown(seconds)
    localStorage.setItem(RECORD_COUNTDOWN_KEY, seconds)
  }
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

  useEffect(() => {
    if (!capturingEmergency) return
    const capture = (event: KeyboardEvent) => {
      event.preventDefault()
      if (event.key === "Escape") {
        setCapturingEmergency(false)
        return
      }
      if (["ControlLeft", "ControlRight", "AltLeft", "AltRight", "ShiftLeft", "ShiftRight", "MetaLeft", "MetaRight"].includes(event.code)) return
      const parts: string[] = []
      if (event.ctrlKey) parts.push("Control")
      if (event.altKey) parts.push("Alt")
      if (event.shiftKey) parts.push("Shift")
      if (event.metaKey) parts.push("Meta")
      parts.push(event.code)
      const shortcut = parts.join("+")
      const duplicate = profileHotkeys.find((profile) => codeToShortcut(profile.hotkey).toLowerCase() === codeToShortcut(shortcut).toLowerCase())
      if (duplicate) {
        toast.error(`Hotkey already used by "${duplicate.name}"`)
        return
      }
      onSetEmergencyHotkey(shortcut)
      setCapturingEmergency(false)
    }
    window.addEventListener("keydown", capture)
    return () => window.removeEventListener("keydown", capture)
  }, [capturingEmergency, onSetEmergencyHotkey, profileHotkeys])

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
    try {
      await getCurrentWindow().setAlwaysOnTop(v)
      setAlwaysOnTop(v)
      localStorage.setItem("combo-macro-always-on-top", String(v))
    } catch (error) {
      toast.error(`Always on top failed: ${error}`)
    }
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
    <div className="grid h-full min-h-0 grid-cols-2 content-start overflow-y-auto p-2 text-[13px] [&_label]:text-[13px]">
        <section className="flex flex-col gap-2 pr-4">
        <h2 className="text-[13px] font-semibold">Window &amp; files</h2>

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

        <div className="flex flex-col gap-1.5">
          <Label className="font-normal">
            Combo files directory
          </Label>
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
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

        </section>

        <section className="flex flex-col gap-2 border-l pl-4">
        <h2 className="text-[13px] font-semibold">Automation</h2>

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

        <div className="flex flex-col gap-1.5">
          <div>
            <Label htmlFor="game-process" className="font-normal">Game process</Label>
            <p className="text-[11px] leading-4 text-muted-foreground">Choose the game that should keep focus during playback.</p>
          </div>
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
              className="w-full text-[13px]"
            />
            <ComboboxContent className="w-[360px] max-w-[calc(100vw-32px)] rounded-xl">
              <ComboboxList>
                {loading || processes.length === 0 ? (
                  <ComboboxEmpty>{loading ? "Loading processes…" : "No processes found"}</ComboboxEmpty>
                ) : (
                  <>
                    {processes.map((p) => {
                      const primary = p.friendly ?? p.title ?? p.name
                      return (
                        <ComboboxItem key={p.pid} value={p.name} className="flex-col items-start gap-0.5 rounded-lg py-2 text-[13px]">
                          <span className="w-full truncate">{primary}</span>
                          {primary !== p.name && (
                            <span className="w-full truncate text-[11px] font-normal text-muted-foreground">
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
        <h3 className="mt-1 border-t pt-2 text-[13px] font-semibold">Recording</h3>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="font-normal">Recording countdown</Label>
            <p className="text-[11px] leading-4 text-muted-foreground">Time to switch to the target window.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={countdownPreset} onValueChange={(value) => {
              if (!value) return
              if (value !== "custom") updateRecordCountdown(value)
              else if (["3", "5", "10"].includes(recordCountdown)) updateRecordCountdown("4")
            }}>
              <SelectTrigger size="sm" className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 sec</SelectItem>
                <SelectItem value="5">5 sec</SelectItem>
                <SelectItem value="10">10 sec</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            {countdownPreset === "custom" && (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={recordCountdown}
                  onChange={(event) => updateRecordCountdown(event.target.value)}
                  className="h-8 w-16"
                  aria-label="Custom recording countdown seconds"
                />
                <span className="text-xs text-muted-foreground">sec</span>
              </div>
            )}
          </div>
        </div>

        </section>

        <section className="col-span-2 mt-4 flex flex-col gap-2 border-t pt-4">
        <h2 className="text-[13px] font-semibold">Safety</h2>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-muted-foreground" />
            <div>
              <Label className="font-normal">Emergency stop</Label>
              <p className="text-[11px] leading-4 text-muted-foreground">Stops macros and active recording.</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCapturingEmergency(true)}
            >
              {capturingEmergency ? "Press a key…" : emergencyHotkey ? <Kbd>{codeToLabel(emergencyHotkey)}</Kbd> : "Set hotkey"}
            </Button>
            {emergencyHotkey && (
              <Button size="icon" variant="ghost" className="size-7" aria-label="Clear emergency hotkey" onClick={() => onSetEmergencyHotkey("")}>
                <X className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
        </section>
    </div>
  )
}
