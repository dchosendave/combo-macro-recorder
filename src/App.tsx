import { useCallback, useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { save, open } from "@tauri-apps/plugin-dialog"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { AppHeader } from "@/components/recorder/AppHeader"
import { KeysTab } from "@/components/recorder/KeysTab"
import { SkillsTab } from "@/components/recorder/SkillsTab"
import { HotkeysTab } from "@/components/recorder/HotkeysTab"
import { RunControl } from "@/components/recorder/RunControl"
import { useSettings } from "@/hooks/useSettings"
import { useMacroRunner } from "@/hooks/useMacroRunner"
import { useHotkey } from "@/hooks/useHotkey"
import { toAccelerator, exportProfileToString, importProfileFromString } from "@/lib/settings"
import "./App.css"

function App() {
  const settings = useSettings()
  const [capturing, setCapturing] = useState(false)

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
  })

  useHotkey({
    setHotkey: settings.setHotkey,
    capturing,
    setCapturing,
  })

  const handleReset = useCallback(() => {
    invoke("stop_all")
    settings.reset()
  }, [settings])

  const handleExport = useCallback(async () => {
    try {
      const current = settings.buildSettings()
      const json = exportProfileToString(current)
      const path = await save({
        defaultPath: "combo-profile.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      })
      if (!path) return
      await invoke("save_file", { path, content: json })
      toast.success("Profile exported")
    } catch (e) {
      toast.error(`Export failed: ${e}`)
    }
  }, [settings])

  const handleImport = useCallback(async () => {
    try {
      const path = await open({
        filters: [{ name: "JSON", extensions: ["json"] }],
        multiple: false,
      })
      if (!path) return
      const content = await invoke<string>("read_file", { path: path as string })
      const current = settings.buildSettings()
      const { settings: imported, name } = importProfileFromString(content, current)
      settings.applySettings(imported)
      toast.success(`Imported "${name}"`)
    } catch (e) {
      toast.error(`Import failed: ${e}`)
    }
  }, [settings])

  useEffect(() => {
    const unlisten = listen("macro-toggle", () => {
      toggleRunning()
    })
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [toggleRunning])

  useEffect(() => {
    invoke("set_hotkey", { shortcut: toAccelerator(settings.hotkey) }).catch(
      () => toast.warning(`"${settings.hotkey}" can't be used as a global hotkey`),
    )
  }, [settings.hotkey])

  return (
    <main className="flex min-h-screen flex-col gap-4 p-4">
      <AppHeader
        running={anyRunning}
        elapsed={elapsed}
        activations={totalCycles}
        onReset={handleReset}
        onExport={handleExport}
        onImport={handleImport}
      />

      <Tabs defaultValue="potions" className="flex-1">
        <TabsList className="w-full">
          <TabsTrigger value="potions">Potions</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="hotkeys">Hotkeys</TabsTrigger>
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
            repeatMode={settings.skillsRepeatMode}
            setRepeatMode={settings.setSkillsRepeatMode}
            repeatCount={settings.skillsRepeatCount}
            setRepeatCount={settings.setSkillsRepeatCount}
            repeatError={settings.skillsRepeatError}
          />
        </TabsContent>

        <TabsContent value="hotkeys">
          <HotkeysTab
            hotkey={settings.hotkey}
            capturing={capturing}
            setCapturing={setCapturing}
          />
        </TabsContent>
      </Tabs>

      <RunControl
        running={anyRunning}
        canRun={settings.canRun}
        hotkey={settings.hotkey}
        onToggle={toggleRunning}
      />
    </main>
  )
}

export default App
