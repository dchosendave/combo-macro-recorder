import { useCallback, useEffect, useRef, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/ui/tabs"
import { AppHeader } from "@/app/app-header"
import { TitleBar } from "@/app/title-bar"
import { KeysTab } from "@/potions/keys-tab"
import { SkillsTab } from "@/skills/skills-tab"
import { HotkeysTab } from "@/hotkeys/hotkeys-tab"
import { CompactOverlay } from "@/runner/compact-overlay"
import { StartupDialog } from "@/combo-file/startup-dialog"
import { ConfirmDiscardDialog } from "@/combo-file/confirm-discard-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog"
import { useSettings } from "@/app/use-settings"
import { useMacroRunner } from "@/runner/use-macro-runner"
import { useCompactMode } from "@/runner/use-compact-mode"
import { useComboFile } from "@/combo-file/use-combo-file"
import { useGlobalHotkeys } from "@/hotkeys/use-global-hotkeys"
import { codeToLabel } from "@/shared/keycodes"
import "./App.css"

function App() {
  const settings = useSettings()
  const { compactMode, compactCorner, setCompactCorner, enterCompact, exitCompact } = useCompactMode()

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
    isProcessing,
    pendingAction,
    requestOpen,
    requestNew,
    confirmDiscard,
    cancelDiscard,
    tryAutoLoad,
  } = useComboFile({ getCombo, applyCombo: settings.applyCombo, onSave: clearCachedCombo })

  const [showStartup, setShowStartup] = useState(true)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [startupChecked, setStartupChecked] = useState(false)

  useEffect(() => {
    if (startupChecked) return
    setStartupChecked(true)
    ;(async () => {
      const loaded = await tryAutoLoad()
      if (loaded) setShowStartup(false)
    })()
  }, [tryAutoLoad, startupChecked])

  const runningProfileName = runningProfileIdRef.current
    ? settings.hotkeys.find((p) => p.id === runningProfileIdRef.current)?.name ?? null
    : null

  const handleRequestClose = useCallback(() => {
    if (isDirty) {
      setShowCloseConfirm(true)
    } else {
      getCurrentWindow().close()
    }

  }, [isDirty])

  const handleCloseConfirm = () => {
    getCurrentWindow().close()
  }

  const handleCloseCancel = () => {
    setShowCloseConfirm(false)
  }

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

  const [activeTab, setActiveTab] = useState("combo")

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Tab") {
      e.preventDefault()
      setActiveTab((prev) => {
        if (e.shiftKey) return prev === "combo" ? "profiles" : "combo"
        return prev === "combo" ? "profiles" : "combo"
      })
    }
  }, [])

  if (compactMode) {
    return (
      <CompactOverlay
        elapsed={elapsed}
        activations={totalCycles}
        potionsActive={settings.potionsCanRun}
        skillsActive={settings.skillsCanRun}
        hotkey={codeToLabel(settings.hotkey)}
        profileName={runningProfileName}
        onStop={() => toggleRunning()}
      />
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden" onKeyDown={handleKeyDown}>
      <TitleBar onRequestClose={handleRequestClose} />
      <main className="flex flex-1 min-h-0 flex-col gap-4 p-4">
        <AppHeader
          running={anyRunning}
          elapsed={elapsed}
          fileName={currentFilePath}
          isDirty={isDirty}
          isProcessing={isProcessing}
          onReset={handleReset}
          onOpen={requestOpen}
          onNew={requestNew}
          onSave={saveFile}
          onSaveAs={saveFileAs}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0">
          <TabsList className="w-full">
            <TabsTrigger value="combo">Combo</TabsTrigger>
            <TabsTrigger value="profiles">Hotkeys</TabsTrigger>
          </TabsList>

          <TabsContent value="combo" className="flex-1 min-h-0 flex flex-col animate-in fade-in-0 duration-200">
            <Tabs defaultValue="potions" className="flex-1 min-h-0 flex flex-col">
              <TabsList variant="line" className="w-full h-7">
                <TabsTrigger value="potions" className="text-xs px-2">Potions</TabsTrigger>
                <TabsTrigger value="skills" className="text-xs px-2">Skills</TabsTrigger>
              </TabsList>

              <TabsContent value="potions" className="flex-1 min-h-0 animate-in fade-in-0 duration-200">
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

              <TabsContent value="skills" className="flex-1 min-h-0 animate-in fade-in-0 duration-200">
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
                  onUndo={settings.undoSteps}
                  onRedo={settings.redoSteps}
                  canUndo={settings.canUndoSteps}
                  canRedo={settings.canRedoSteps}
                  onRecordedSteps={settings.onRecordedSteps}
                />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="profiles" className="flex-1 min-h-0 animate-in fade-in-0 duration-200">
            <HotkeysTab
              hotkeys={settings.hotkeys}
              compactCorner={compactCorner}
              onAddHotkey={settings.addHotkey}
              onDeleteHotkey={settings.deleteHotkey}
              onUpdateHotkey={settings.updateHotkeyBinding}
              onUpdatePath={settings.updateHotkeyPath}
              onMoveHotkeyUp={settings.moveHotkeyUp}
              onMoveHotkeyDown={settings.moveHotkeyDown}
              onSetCompactCorner={setCompactCorner}
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

        <AlertDialog open={showCloseConfirm}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
              <AlertDialogDescription>
                You have unsaved changes. Close without saving?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleCloseCancel}>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleCloseConfirm}>
                Discard &amp; Close
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  )
}

export default App
