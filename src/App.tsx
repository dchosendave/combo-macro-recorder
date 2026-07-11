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
import { ProfilesTab } from "@/components/recorder/ProfilesTab"
import { RunControl } from "@/components/recorder/RunControl"
import { CompactOverlay } from "@/components/recorder/CompactOverlay"
import { useSettings } from "@/hooks/useSettings"
import { useMacroRunner } from "@/hooks/useMacroRunner"
import { toAccelerator, exportProfilesToString, importProfilesFromString } from "@/lib/settings"
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
    onStop: exitCompact,
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
      const imported = importProfilesFromString(content)
      if (imported.length === 0) {
        toast.error("No profiles found in file")
        return
      }
      settings.setProfilesAll(imported)
      setCurrentFilePath(path as string)
      const openedName = (path as string).split(/[\\/]/).pop() ?? path
      toast.success(`Opened ${openedName}`)
    } catch (e) {
      toast.error(`Open failed: ${e}`)
    }
  }, [settings])

  const saveToPath = useCallback(async (path: string) => {
    const json = exportProfilesToString(settings.profiles)
    await invoke("save_file", { path, content: json })
    setCurrentFilePath(path)
  }, [settings.profiles])

  const handleSave = useCallback(async () => {
    try {
      const existing = currentFilePathRef.current
      if (existing) {
        await saveToPath(existing)
        toast.success("Saved")
        return
      }
      const path = await save({
        defaultPath: "combo-profiles.json",
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
        defaultPath: "combo-profiles.json",
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
    const hotkeys = settings.profiles.map((p) => ({
      shortcut: toAccelerator(p.hotkey),
      profileId: p.id,
    }))
    invoke("set_hotkeys", { hotkeys }).catch(
      () => toast.warning("Failed to register global hotkeys"),
    )
  }, [settings.profiles])

  useEffect(() => {
    const unlisten = listen<string>("macro-toggle", (event) => {
      const profileId = event.payload
      if (profileId !== settings.activeProfileId) {
        settings.setActiveProfileId(profileId)
        setTimeout(() => toggleRunning(), 0)
      } else {
        toggleRunning()
      }
    })
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [toggleRunning, settings.activeProfileId])

  if (compactMode) {
    return (
      <CompactOverlay
        elapsed={elapsed}
        activations={totalCycles}
        potionsActive={settings.potionsCanRun}
        skillsActive={settings.skillsCanRun}
        hotkey={settings.hotkey}
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

      <Tabs defaultValue="potions" className="flex-1 min-h-0">
        <TabsList className="w-full">
          <TabsTrigger value="potions">Potions</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="profiles">Profiles</TabsTrigger>
        </TabsList>

        <TabsContent value="potions">
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

        <TabsContent value="skills">
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

        <TabsContent value="profiles">
          <ProfilesTab
            profiles={settings.profiles}
            activeProfileId={settings.activeProfileId}
            setActiveProfileId={settings.setActiveProfileId}
            onAddProfile={settings.addProfile}
            onDeleteProfile={settings.deleteProfile}
            onRenameProfile={settings.renameProfile}
            onUpdateHotkey={settings.updateProfileHotkey}
          />
        </TabsContent>
      </Tabs>

      <RunControl
        running={anyRunning}
        canRun={settings.canRun}
        hotkey={settings.hotkey}
        onToggle={() => toggleRunning()}
      />
    </main>
  )
}

export default App
