import { useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"
import { clearHotkeys, loadHotkeys, saveHotkeys } from "@/shared/persistence"
import { defaultPotionConfig, defaultSkillConfig, makeDefaultSettings } from "@/shared/defaults"
import type { CurrentCombo, SettingsV3 } from "@/shared/types"
import { usePotionSettings } from "@/potions/use-potion-settings"
import { useSkillSettings } from "@/skills/use-skill-settings"
import { useHotkeySettings } from "@/hotkeys/use-hotkey-settings"

export function useSettings() {
  const potions = usePotionSettings(defaultPotionConfig())
  const skills = useSkillSettings(defaultSkillConfig())
  const hotkeysFeature = useHotkeySettings(loadHotkeys())

  const canRun = potions.potionsCanRun || skills.skillsCanRun

  const applyCombo = useCallback(
    (combo: CurrentCombo) => {
      potions.apply(combo.potions)
      skills.apply(combo.skills)
    },
    [potions.apply, skills.apply],
  )

  const reset = useCallback(() => {
    const defaults = makeDefaultSettings()
    potions.apply(defaults.current.potions)
    skills.apply(defaults.current.skills)
    hotkeysFeature.setHotkeys(defaults.hotkeys)
    clearHotkeys()
    toast("Settings reset to defaults")
  }, [potions.apply, skills.apply, hotkeysFeature.setHotkeys])

  const buildSettings = useCallback(
    (): SettingsV3 => ({
      version: 3,
      current: {
        potions: potions.persisted,
        skills: skills.persisted,
      },
      hotkeys: hotkeysFeature.persisted,
    }),
    [potions.persisted, skills.persisted, hotkeysFeature.persisted],
  )

  // Debounce hotkey persistence to avoid jank during rapid edits.
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
    persistTimerRef.current = setTimeout(() => {
      saveHotkeys(hotkeysFeature.persisted)
      persistTimerRef.current = null
    }, 300)
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
    }
  }, [hotkeysFeature.persisted])

  return {
    // Potions
    potionsEnabled: potions.potionsEnabled, setPotionsEnabled: potions.setPotionsEnabled,
    potionKeys: potions.potionKeys, togglePotionKey: potions.togglePotionKey,
    customDelay: potions.customDelay, setCustomDelayEnabled: potions.setCustomDelayEnabled,
    delayMs: potions.delayMs, setDelayMs: potions.setDelayMs,
    potionsRepeatMode: potions.potionsRepeatMode, setPotionsRepeatMode: potions.setPotionsRepeatMode,
    potionsRepeatCount: potions.potionsRepeatCount, setPotionsRepeatCount: potions.setPotionsRepeatCount,
    potionsDelayError: potions.potionsDelayError, potionsRepeatError: potions.potionsRepeatError,
    potionsCanRun: potions.potionsCanRun,
    // Skills
    skillsEnabled: skills.skillsEnabled, setSkillsEnabled: skills.setSkillsEnabled,
    holdRightClick: skills.holdRightClick, setHoldRightClick: skills.setHoldRightClick,
    skillSteps: skills.skillSteps, setSkillSteps: skills.setSkillSteps,
    addSkillKeydown: skills.addSkillKeydown, addSkillKeyup: skills.addSkillKeyup, addSkillDelay: skills.addSkillDelay,
    removeSkillStep: skills.removeSkillStep, moveSkillStepUp: skills.moveSkillStepUp, moveSkillStepDown: skills.moveSkillStepDown,
    duplicateSkillStep: skills.duplicateSkillStep, updateSkillStep: skills.updateSkillStep,
    labelStyle: skills.labelStyle, setLabelStyle: skills.setLabelStyle,
    skillsRepeatMode: skills.skillsRepeatMode, setSkillsRepeatMode: skills.setSkillsRepeatMode,
    skillsRepeatCount: skills.skillsRepeatCount, setSkillsRepeatCount: skills.setSkillsRepeatCount,
    skillsRepeatError: skills.skillsRepeatError, skillsCanRun: skills.skillsCanRun,
    // Undo/Redo
    undoSteps: skills.undoSteps, redoSteps: skills.redoSteps,
    canUndoSteps: skills.canUndo, canRedoSteps: skills.canRedo,
    // Recording
    onRecordedSteps: skills.setSkillSteps,
    // Hotkeys
    hotkeys: hotkeysFeature.hotkeys,
    addHotkey: hotkeysFeature.addHotkey, deleteHotkey: hotkeysFeature.deleteHotkey, renameHotkey: hotkeysFeature.renameHotkey,
    updateHotkeyBinding: hotkeysFeature.updateHotkeyBinding, updateHotkeyPath: hotkeysFeature.updateHotkeyPath,
    moveHotkeyUp: hotkeysFeature.moveHotkeyUp, moveHotkeyDown: hotkeysFeature.moveHotkeyDown,
    applyCombo,
    // Global
    hotkey: hotkeysFeature.hotkey, canRun, reset,
    potionsConfig: potions.potionsConfig, skillsConfig: skills.skillsConfig,
    buildSettings,
  }
}
