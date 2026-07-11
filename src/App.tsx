import { useCallback, useEffect, useRef, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { LogicalSize } from "@tauri-apps/api/dpi"
import { save, open } from "@tauri-apps/plugin-dialog"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { AppHeader } from "@/components/recorder/AppHeader"
import { KeysTab } from "@/components/recorder/KeysTab"
import { SkillsTab } from "@/components/recorder/SkillsTab"
import { HotkeysTab } from "@/components/recorder/HotkeysTab"
import { RunControl } from "@/components/recorder/RunControl"
import { CompactOverlay } from "@/components/recorder/CompactOverlay"
import { useSettings } from "@/hooks/useSettings"
import { useMacroRunner } from "@/hooks/useMacroRunner"
import { codeToShortcut, codeToLabel, exportComboToString, importComboFromString } from "@/lib/settings"
import "./App.css"

function App() {
  const settings = useSettings()
  const [compactMode, setCompactMode] = useState(false)
  const [savedSize, setSavedSize] = useState<LogicalSize | null>(null)
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null)

  const compactModeRef = useRef(compactMode)
  compactModeRef.current = compactMode

  const currentFilePathRef = useRef(currentFilePath)
  currentFilePathRef.current = currentFilePath

  const COMPACT = new LogicalSize(500, 68)

  const enterCompact = useCallback(async () => {
    try {
      const win = getCurrentWindow()
      const current = await win.innerSize()
      setSavedSize(new LogicalSize(current))
      await win.setSizeConstraints(null)
      await win.setResizable(true)
      await win.setSize(COMPACT)
      await win.setResizable(false)
      setCompactMode(true)
    } catch (e) {
      toast.error(`Compact mode failed: ${e}`)
    }
  }, [])

  const exitCompact = useCallback(async () => {
    if (!compactModeRef.current) return
    try {
      const win = getCurrentWindow()
      await win.setSize(savedSize ?? new LogicalSize(660, 720))
    } catch (e) {
      toast.error(`Restore mode failed: ${e}`)
    }
    setCompactMode(false)
  }, [savedSize])

  const runningProfileIdRef = useRef<string | null>(null)

  const handleStop = useCallback(() => {
    exitCompact()
    runningProfileIdRef.current = null
  }, [exitCompact])

  const {
    anyRunning,
    elapsed,
    totalCycles,
    toggleRunning,
  } = useMacroRunner({
    potionsCanRun: settings.potionsCanRun,
    potionsConfig: settings.potionsConfig,
    skillsCanRun: settings.skillsCanRun,
    skillsConfig: settings.skillsConfig,
    onStart: enterCompact,
    onStop: handleStop,
  })

  const handleReset = useCallback(() => {
    invoke("stop_all")
    settings.reset()
    exitCompact()
    setCurrentFilePath(null)
  }, [settings, exitCompact])

  const handleOpen = useCallback(async () => {
    try {
      const path = await open({
        filters: [{ name: "JSON", extensions: ["json"] }],
        multiple: false,
      })
      if (!path) return
      const content = await invoke<string>("read_file", { path: path as string })
      const combo = importComboFromString(content)
      settings.applyCombo(combo)
      setCurrentFilePath(path as string)
      const openedName = (path as string).split(/[\\/]/).pop() ?? path
      toast.success(`Opened ${openedName}`)
    } catch (e) {
      toast.error(`Open failed: ${e}`)
    }
  }, [settings])

  const saveToPath = useCallback(async (path: string) => {
    const json = exportComboToString({
      potions: { enabled: settings.potionsEnabled, keys: settings.potionKeys, customDelay: settings.customDelay, delayMs: settings.delayMs, repeatMode: settings.potionsRepeatMode, repeatCount: settings.potionsRepeatCount },
      skills: { enabled: settings.skillsEnabled, holdRightClick: settings.holdRightClick, steps: settings.skillSteps, labelStyle: settings.labelStyle, repeatMode: settings.skillsRepeatMode, repeatCount: settings.skillsRepeatCount },
    })
    await invoke("save_file", { path, content: json })
    setCurrentFilePath(path)
  }, [
    settings.potionsEnabled, settings.potionKeys, settings.customDelay, settings.delayMs,
    settings.potionsRepeatMode, settings.potionsRepeatCount,
    settings.skillsEnabled, settings.holdRightClick, settings.skillSteps, settings.labelStyle,
    settings.skillsRepeatMode, settings.skillsRepeatCount,
  ])

  const handleSave = useCallback(async () => {
    try {
      const existing = currentFilePathRef.current
      if (existing) {
        await saveToPath(existing)
        toast.success("Saved")
        return
      }
      const path = await save({
        defaultPath: "combo.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      })
      if (!path) return
      await saveToPath(path)
      toast.success("Saved")
    } catch (e) {
      toast.error(`Save failed: ${e}`)
    }
  }, [saveToPath])

  const handleSaveAs = useCallback(async () => {
    try {
      const path = await save({
        defaultPath: "combo.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      })
      if (!path) return
      await saveToPath(path)
      toast.success("Saved")
    } catch (e) {
      toast.error(`Save failed: ${e}`)
    }
  }, [saveToPath])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handleSave])

  useEffect(() => {
    const hotkeys = settings.hotkeys
      .filter((p) => p.hotkey)
      .map((p) => ({
        shortcut: codeToShortcut(p.hotkey),
        hotkeyId: p.id,
      }))
    invoke("set_hotkeys", { hotkeys }).catch(
      () => toast.warning("Failed to register global hotkeys"),
    )
  }, [settings.hotkeys])

  const anyRunningRef = useRef(anyRunning)
  anyRunningRef.current = anyRunning

  useEffect(() => {
    const unlisten = listen<string>("macro-toggle", (event) => {
      const hotkeyId = event.payload
      const profile = settings.hotkeys.find((p) => p.id === hotkeyId)
      if (!profile) return

      if (profile.comboPath) {
        // Same profile pressed again → just toggle (stop)
        if (runningProfileIdRef.current === profile.id) {
          toggleRunning()
          return
        }

        // Different profile or nothing running → stop current, load file, start
        invoke("stop_all")
        runningProfileIdRef.current = null
        invoke<string>("read_file", { path: profile.comboPath })
          .then((content) => {
            const combo = importComboFromString(content)
            settings.applyCombo(combo)
            runningProfileIdRef.current = profile.id
            setTimeout(() => toggleRunning(), 0)
          })
          .catch(() => toast.error(`Failed to load ${profile.name}`))
      } else {
        toggleRunning()
      }
    })
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [toggleRunning, settings])

  if (compactMode) {
    return (
      <CompactOverlay
        elapsed={elapsed}
        activations={totalCycles}
        potionsActive={settings.potionsCanRun}
        skillsActive={settings.skillsCanRun}
        hotkey={codeToLabel(settings.hotkey)}
        onStop={() => toggleRunning()}
      />
    )
  }

  return (
    <main className="flex min-h-screen flex-col gap-4 p-4">
      <AppHeader
        running={anyRunning}
        elapsed={elapsed}
        fileName={currentFilePath}
        onReset={handleReset}
        onOpen={handleOpen}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
      />

      <Tabs defaultValue="combo" className="flex-1 min-h-0">
        <TabsList className="w-full">
          <TabsTrigger value="combo">Combo</TabsTrigger>
          <TabsTrigger value="profiles">Hotkeys</TabsTrigger>
        </TabsList>

        <TabsContent value="combo" className="flex-1 min-h-0 flex flex-col">
          <Tabs defaultValue="potions" className="flex-1 min-h-0 flex flex-col">
            <TabsList variant="line" className="w-full h-7">
              <TabsTrigger value="potions" className="text-xs px-2">Potions</TabsTrigger>
              <TabsTrigger value="skills" className="text-xs px-2">Skills</TabsTrigger>
            </TabsList>

            <TabsContent value="potions" className="flex-1 min-h-0">
              <KeysTab
                autoPotions={settings.potionsEnabled}
                setAutoPotions={settings.setPotionsEnabled}
                keys={settings.potionKeys}
                togglePotionKey={settings.togglePotionKey}
                customDelay={settings.customDelay}
                setCustomDelayEnabled={settings.setCustomDelayEnabled}
                delayMs={settings.delayMs}
                setDelayMs={settings.setDelayMs}
                delayError={settings.potionsDelayError}
                repeatMode={settings.potionsRepeatMode}
                setRepeatMode={settings.setPotionsRepeatMode}
                repeatCount={settings.potionsRepeatCount}
                setRepeatCount={settings.setPotionsRepeatCount}
                repeatError={settings.potionsRepeatError}
              />
            </TabsContent>

            <TabsContent value="skills" className="flex-1 min-h-0">
              <SkillsTab
                enabled={settings.skillsEnabled}
                setEnabled={settings.setSkillsEnabled}
                steps={settings.skillSteps}
                onSetSteps={settings.setSkillSteps}
                onAddKeydown={settings.addSkillKeydown}
                onAddKeyup={settings.addSkillKeyup}
                onAddDelay={settings.addSkillDelay}
                onRemoveStep={settings.removeSkillStep}
                onMoveStepUp={settings.moveSkillStepUp}
                onMoveStepDown={settings.moveSkillStepDown}
                onDuplicateStep={settings.duplicateSkillStep}
                onUpdateStep={settings.updateSkillStep}
                labelStyle={settings.labelStyle}
                setLabelStyle={settings.setLabelStyle}
                holdRightClick={settings.holdRightClick}
                setHoldRightClick={settings.setHoldRightClick}
                repeatMode={settings.skillsRepeatMode}
                setRepeatMode={settings.setSkillsRepeatMode}
                repeatCount={settings.skillsRepeatCount}
                setRepeatCount={settings.setSkillsRepeatCount}
                repeatError={settings.skillsRepeatError}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="profiles">
          <HotkeysTab
            hotkeys={settings.hotkeys}
            onAddHotkey={settings.addHotkey}
            onDeleteHotkey={settings.deleteHotkey}
            onRenameHotkey={settings.renameHotkey}
            onUpdateHotkey={settings.updateHotkeyBinding}
            onUpdatePath={settings.updateHotkeyPath}
          />
        </TabsContent>
      </Tabs>

      {/* <RunControl
        running={anyRunning}
        canRun={settings.canRun}
        hotkey={codeToLabel(settings.hotkey)}
        onToggle={() => toggleRunning()}
      /> */}
    </main>
  )
}

export default App
