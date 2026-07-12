import { useCallback, useRef, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/ui/tabs"
import { AppHeader } from "@/app/AppHeader"
import { TitleBar } from "@/app/TitleBar"
import { KeysTab } from "@/features/potions/components/KeysTab"
import { SkillsTab } from "@/features/skills/components/SkillsTab"
import { HotkeysTab } from "@/features/hotkeys/components/HotkeysTab"
import { CompactOverlay } from "@/features/runner/components/CompactOverlay"
import { StartupDialog } from "@/features/combo-file/components/StartupDialog"
import { ConfirmDiscardDialog } from "@/features/combo-file/components/ConfirmDiscardDialog"
import { useSettings } from "@/app/useSettings"
import { useMacroRunner } from "@/features/runner/useMacroRunner"
import { useCompactMode } from "@/features/runner/useCompactMode"
import { useComboFile } from "@/features/combo-file/useComboFile"
import { useGlobalHotkeys } from "@/features/hotkeys/useGlobalHotkeys"
import { codeToLabel } from "@/shared/lib/keycodes"
import "./App.css"

function App() {
  const settings = useSettings()
  const { compactMode, enterCompact, exitCompact } = useCompactMode()

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
    startCombo,
    stopAll,
  } = useMacroRunner({
    potionsCanRun: settings.potionsCanRun,
    potionsConfig: settings.potionsConfig,
    skillsCanRun: settings.skillsCanRun,
    skillsConfig: settings.skillsConfig,
    onStart: enterCompact,
    onStop: handleStop,
  })

  const getCombo = useCallback(
    () => settings.buildSettings().current,
    [settings.buildSettings],
  )

  const { clearCachedCombo } = useGlobalHotkeys({
    hotkeys: settings.hotkeys,
    toggleRunning,
    startCombo,
    stopAll,
    applyCombo: settings.applyCombo,
    runningProfileIdRef,
  })

  const {
    currentFilePath,
    openFile,
    saveFile,
    saveFileAs,
    newCombo,
    isDirty,
    pendingAction,
    requestOpen,
    requestNew,
    confirmDiscard,
    cancelDiscard,
  } = useComboFile({ getCombo, applyCombo: settings.applyCombo, onSave: clearCachedCombo })

  const [showStartup, setShowStartup] = useState(true)

  const handleStartupOpen = useCallback(async () => {
    const ok = await openFile()
    if (ok) setShowStartup(false)
  }, [openFile])

  const handleStartupNew = useCallback(() => {
    newCombo()
    setShowStartup(false)
  }, [newCombo])

  const handleReset = useCallback(() => {
    invoke("stop_all")
    settings.reset()
    newCombo()
    exitCompact()
  }, [settings, exitCompact, newCombo])

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
    <div className="flex h-screen flex-col overflow-hidden">
      <TitleBar />
      <main className="flex flex-1 min-h-0 flex-col gap-4 p-4">
        <AppHeader
          running={anyRunning}
          elapsed={elapsed}
          fileName={currentFilePath}
          isDirty={isDirty}
          onReset={handleReset}
          onOpen={requestOpen}
          onNew={requestNew}
          onSave={saveFile}
          onSaveAs={saveFileAs}
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

        <StartupDialog
          open={showStartup}
          onOpen={handleStartupOpen}
          onNew={handleStartupNew}
        />

        <ConfirmDiscardDialog
          open={pendingAction !== null}
          onConfirm={confirmDiscard}
          onCancel={cancelDiscard}
        />
      </main>
    </div>
  )
}

export default App
