import { useCallback, useEffect, useRef, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { SidebarInset, SidebarProvider } from "@/shared/components/ui/sidebar"
import { AppHeader } from "@/app/app-header"
import { AppSidebar } from "@/app/app-sidebar"
import { TitleBar } from "@/app/title-bar"
import { HelpDialog } from "@/app/help-dialog"
import { KeysTab } from "@/potions/keys-tab"
import { SkillsTab } from "@/skills/skills-tab"
import { HotkeysTab } from "@/hotkeys/hotkeys-tab"
import { SettingsTab } from "@/settings/settings-tab"
import { CompactOverlay } from "@/runner/compact-overlay"
import { StartupDialog } from "@/combo-file/startup-dialog"
import { ConfirmDiscardDialog } from "@/combo-file/confirm-discard-dialog"
import { RecoverComboDialog } from "@/combo-file/recover-combo-dialog"
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
import { useWindowFit } from "@/app/use-window-fit"
import { useMacroRunner } from "@/runner/use-macro-runner"
import { toRunnerInputs } from "@/runner/runner-inputs"
import { useCompactMode } from "@/runner/use-compact-mode"
import { useComboFile } from "@/combo-file/use-combo-file"
import { useRecentFiles } from "@/combo-file/use-recent-files"
import { useComboFiles } from "@/combo-file/use-combo-files"
import { useFirstRun } from "@/app/use-first-run"
import { useGlobalHotkeys } from "@/hotkeys/use-global-hotkeys"
import { codeToLabel } from "@/shared/keycodes"
import type { AutoStopConfig } from "@/shared/types"
import "./App.css"

const AUTO_STOP_KEY = "combo-macro-auto-stop"
const EMERGENCY_HOTKEY_KEY = "combo-macro-emergency-hotkey"

function App() {
  const settings = useSettings()
  const { compactMode, compactCorner, setCompactCorner, enterCompact, exitCompact } = useCompactMode()
  useWindowFit()

  const runningProfileIdRef = useRef<string | null>(null)
  const [emergencyHotkey, setEmergencyHotkey] = useState(
    () => localStorage.getItem(EMERGENCY_HOTKEY_KEY) ?? "",
  )
  const updateEmergencyHotkey = useCallback((value: string) => {
    setEmergencyHotkey(value)
    if (value) localStorage.setItem(EMERGENCY_HOTKEY_KEY, value)
    else localStorage.removeItem(EMERGENCY_HOTKEY_KEY)
  }, [])

  // Auto-stop-on-focus-loss is an app-level pref (like always-on-top), owned
  // here so the runner hook and the Settings tab share one source.
  const [autoStop, setAutoStopState] = useState<AutoStopConfig>(() => {
    try {
      const saved = localStorage.getItem(AUTO_STOP_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as AutoStopConfig
        return {
          enabled: !!parsed.enabled,
          gameProcess: typeof parsed.gameProcess === "string" ? parsed.gameProcess : "",
        }
      }
    } catch {
      // corrupted value — fall through to the default
    }
    return { enabled: false, gameProcess: "" }
  })

  const setAutoStop = useCallback((value: AutoStopConfig) => {
    setAutoStopState(value)
    localStorage.setItem(AUTO_STOP_KEY, JSON.stringify(value))
  }, [])

  const handleStop = useCallback(() => {
    exitCompact()
    runningProfileIdRef.current = null
  }, [exitCompact])

  const {
    anyRunning,
    elapsed,
    totalCycles,
    activeSkillStepIndex,
    lastStopReason,
    toggleRunning,
    startCombo,
    stopAll,
  } = useMacroRunner({
    potionsCanRun: settings.potionsCanRun,
    potionsConfig: settings.potionsConfig,
    skillsCanRun: settings.skillsCanRun,
    skillsConfig: settings.skillsConfig,
    autoStop,
    onStart: enterCompact,
    onStop: handleStop,
  })

  const getCombo = useCallback(
    () => settings.buildSettings().current,
    [settings.buildSettings],
  )

  const { clearCachedCombo, registrationStatus, registrationError, unavailablePaths } = useGlobalHotkeys({
    hotkeys: settings.hotkeys,
    emergencyHotkey,
    onEmergencyStop: () => {
      void stopAll("emergency")
      window.dispatchEvent(new Event("macro-emergency-stop"))
    },
    toggleRunning,
    startCurrentCombo: () => startCombo(toRunnerInputs(getCombo())),
    startCombo,
    stopAll,
    applyCombo: settings.applyCombo,
    runningProfileIdRef,
  })

  const { recentFiles, addRecent, removeRecent, clearRecent } = useRecentFiles()
  const { comboFiles, refreshComboFiles } = useComboFiles()

  const {
    currentFilePath,
    openFile,
    saveFile,
    saveFileAs,
    newCombo,
    isDirty,
    isProcessing,
    lastSavedAt,
    pendingAction,
    pendingRecovery,
    requestOpen,
    requestNew,
    requestOpenPath,
    confirmDiscard,
    cancelDiscard,
    confirmRecovery,
    cancelRecovery,
    tryAutoLoad,
  } = useComboFile({
    getCombo,
    applyCombo: settings.applyCombo,
    onOpened: addRecent,
    onOpenFailed: removeRecent,
    onSave: (path) => {
      clearCachedCombo(path)
      addRecent(path)
    },
  })

  const { isFirstRun, markTutorialSeen } = useFirstRun()
  const [showStartup, setShowStartup] = useState(isFirstRun)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [startupChecked, setStartupChecked] = useState(false)

  useEffect(() => {
    if (startupChecked) return
    setStartupChecked(true)
    ;(async () => {
      const loaded = await tryAutoLoad()
      if (loaded) {
        setShowStartup(false)
        markTutorialSeen()
      }
    })()
  }, [tryAutoLoad, startupChecked, markTutorialSeen])

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
    if (ok) {
      setShowStartup(false)
      markTutorialSeen()
    }
  }, [openFile, markTutorialSeen])

  const handleOpenRecent = useCallback((path: string) => {
    requestOpenPath(path)
  }, [requestOpenPath])

  const handleStartupNew = useCallback(() => {
    newCombo()
    setShowStartup(false)
    markTutorialSeen()
  }, [newCombo, markTutorialSeen])

  const handleStartupSkip = useCallback(() => {
    setShowStartup(false)
    markTutorialSeen()
  }, [markTutorialSeen])

  const handleReset = useCallback(() => {
    invoke("stop_all")
    settings.reset()
    newCombo()
    exitCompact()
  }, [settings, exitCompact, newCombo])

  const [activeTab, setActiveTab] = useState<"combo" | "profiles" | "settings">("combo")
  const [innerTab, setInnerTab] = useState<"potions" | "skills">("potions")

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Tab") {
      e.preventDefault()
      const ORDER = ["combo", "profiles", "settings"] as const
      setActiveTab((prev) => {
        const idx = ORDER.indexOf(prev as (typeof ORDER)[number])
        const dir = e.shiftKey ? -1 : 1
        return ORDER[(idx + dir + ORDER.length) % ORDER.length]
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
        onExpand={() => { void exitCompact() }}
      />
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden" onKeyDown={handleKeyDown}>
      <TitleBar onRequestClose={handleRequestClose} />
      <SidebarProvider className="flex-1 min-h-0">
        <AppSidebar
          activeTab={activeTab}
          innerTab={innerTab}
          onSelectTab={setActiveTab}
          onSelectInnerTab={(tab) => {
            setActiveTab("combo")
            setInnerTab(tab)
          }}
          onOpenHelp={() => setShowHelp(true)}
        />
        <SidebarInset className="min-h-0 min-w-0 overflow-hidden gap-4 p-4">
        <AppHeader
          running={anyRunning}
          elapsed={elapsed}
          fileName={currentFilePath}
          isDirty={isDirty}
          isProcessing={isProcessing}
          lastSavedAt={lastSavedAt}
          canRun={settings.canRun}
          compactMode={compactMode}
          lastStopReason={lastStopReason}
          onToggleRunning={toggleRunning}
          onReset={handleReset}
          onOpen={requestOpen}
          onNew={requestNew}
          onSave={saveFile}
          onSaveAs={saveFileAs}
          recentFiles={recentFiles}
          onOpenRecent={handleOpenRecent}
          onClearRecent={clearRecent}
          comboFiles={comboFiles}
          onRequestComboFiles={refreshComboFiles}
          onSelectComboFile={requestOpenPath}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden animate-in fade-in-0 duration-200">
          {activeTab === "combo" ? (
            innerTab === "potions" ? (
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
            ) : (
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
                playbackSpeed={settings.playbackSpeed}
                setPlaybackSpeed={settings.setPlaybackSpeed}
                repeatError={settings.skillsRepeatError}
                keyError={settings.skillsKeyError}
                unmatchedKeydowns={settings.unmatchedKeydowns}
                onUndo={settings.undoSteps}
                onRedo={settings.redoSteps}
                canUndo={settings.canUndoSteps}
                canRedo={settings.canRedoSteps}
                onRecordedSteps={settings.onRecordedSteps}
                hasComboFile={currentFilePath !== null}
                activeRunStepIndex={activeSkillStepIndex}
                runnerActive={anyRunning}
              />
            )
          ) : activeTab === "profiles" ? (
            <HotkeysTab
              hotkeys={settings.hotkeys}
              emergencyHotkey={emergencyHotkey}
              registrationStatus={registrationStatus}
              registrationError={registrationError}
              unavailablePaths={unavailablePaths}
              onAddHotkey={settings.addHotkey}
              onDeleteHotkey={settings.deleteHotkey}
              onUpdateHotkey={settings.updateHotkeyBinding}
              onUpdatePath={settings.updateHotkeyPath}
              onUpdateMode={settings.updateHotkeyMode}
              onUpdateCyclePaths={settings.updateHotkeyCyclePaths}
              onMoveHotkeyUp={settings.moveHotkeyUp}
              onMoveHotkeyDown={settings.moveHotkeyDown}
            />
          ) : (
            <SettingsTab
              compactCorner={compactCorner}
              onSetCompactCorner={setCompactCorner}
              autoStop={autoStop}
              onSetAutoStop={setAutoStop}
              emergencyHotkey={emergencyHotkey}
              onSetEmergencyHotkey={updateEmergencyHotkey}
              profileHotkeys={settings.hotkeys}
            />
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>

    <StartupDialog
      open={showStartup}
      onOpen={handleStartupOpen}
      onNew={handleStartupNew}
      onSkip={handleStartupSkip}
    />

    <ConfirmDiscardDialog
      open={pendingAction !== null}
      onConfirm={confirmDiscard}
      onCancel={cancelDiscard}
    />

    <HelpDialog open={showHelp} onOpenChange={setShowHelp} />

    <RecoverComboDialog
      open={pendingRecovery !== null}
      onRecover={() => { void confirmRecovery() }}
      onCancel={cancelRecovery}
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
    </div>
  )
}

export default App
