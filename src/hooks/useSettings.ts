import { useCallback, useEffect, useMemo, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"
import {
  MIN_DELAY,
  MIN_REPEAT,
  clearSettings,
  loadSettings,
  makeDefaultSettings,
  saveSettings,
  importComboFromString,
  type PotionKey,
  type HotkeyBinding,
  type RepeatMode,
  type SettingsV3,
  type SkillStep,
  type StepLabelStyle,
} from "@/lib/settings"

export function useSettings() {
  const initial = loadSettings()

  const [potionsEnabled, setPotionsEnabled] = useState(initial.current.potions.enabled)
  const [potionKeys, setPotionKeys] = useState(initial.current.potions.keys)
  const [customDelay, setCustomDelay] = useState(initial.current.potions.customDelay)
  const [delayMs, setDelayMs] = useState(initial.current.potions.delayMs)
  const [potionsRepeatMode, setPotionsRepeatMode] = useState<RepeatMode>(initial.current.potions.repeatMode)
  const [potionsRepeatCount, setPotionsRepeatCount] = useState(initial.current.potions.repeatCount)

  const [skillsEnabled, setSkillsEnabled] = useState(initial.current.skills.enabled)
  const [holdRightClick, setHoldRightClick] = useState(initial.current.skills.holdRightClick)
  const [skillSteps, setSkillSteps] = useState<SkillStep[]>(initial.current.skills.steps)
  const [labelStyle, setLabelStyle] = useState<StepLabelStyle>(initial.current.skills.labelStyle)
  const [skillsRepeatMode, setSkillsRepeatMode] = useState<RepeatMode>(initial.current.skills.repeatMode)
  const [skillsRepeatCount, setSkillsRepeatCount] = useState(initial.current.skills.repeatCount)

  const [hotkeys, setHotkeys] = useState<HotkeyBinding[]>(initial.hotkeys)

  const potionsDelayError =
    customDelay && delayMs !== "" && Number(delayMs) < MIN_DELAY
  const potionsRepeatError =
    potionsRepeatMode === "count" &&
    (potionsRepeatCount === "" || Number(potionsRepeatCount) < MIN_REPEAT)
  const anyPotionKeyEnabled = Object.values(potionKeys).some(Boolean)
  const potionsCanRun =
    potionsEnabled && anyPotionKeyEnabled && !potionsDelayError && !potionsRepeatError

  const skillsRepeatError =
    skillsRepeatMode === "count" &&
    (skillsRepeatCount === "" || Number(skillsRepeatCount) < MIN_REPEAT)
  const skillsCanRun =
    skillsEnabled &&
    skillSteps.some((s) => s.type === "keydown") &&
    !skillsRepeatError

  const canRun = potionsCanRun || skillsCanRun

  const togglePotionKey = (key: PotionKey) =>
    setPotionKeys((prev) => ({ ...prev, [key]: !prev[key] }))

  const setCustomDelayEnabled = (enabled: boolean) => {
    setCustomDelay(enabled)
    if (!enabled) setDelayMs(String(MIN_DELAY))
  }

  // Hotkey CRUD
  const addHotkey = useCallback(() => {
    setHotkeys((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: `Hotkey ${prev.length + 1}`,
        hotkey: "F5",
        comboPath: "",
      },
    ])
  }, [])

  const deleteHotkey = useCallback((id: string) => {
    setHotkeys((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((p) => p.id !== id)
    })
  }, [])

  const renameHotkey = useCallback((id: string, name: string) => {
    setHotkeys((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)))
  }, [])

  const updateHotkeyBinding = useCallback((id: string, hotkey: string) => {
    setHotkeys((prev) => prev.map((p) => (p.id === id ? { ...p, hotkey } : p)))
  }, [])

  const updateHotkeyPath = useCallback((id: string, comboPath: string) => {
    setHotkeys((prev) => prev.map((p) => (p.id === id ? { ...p, comboPath } : p)))
  }, [])

  // Load combo from a file path into current config
  const loadComboFromFile = useCallback(async (filePath: string) => {
    const content = await invoke<string>("read_file", { path: filePath })
    const combo = importComboFromString(content)
    setPotionsEnabled(combo.potions.enabled)
    setPotionKeys(combo.potions.keys)
    setCustomDelay(combo.potions.customDelay)
    setDelayMs(combo.potions.delayMs)
    setPotionsRepeatMode(combo.potions.repeatMode)
    setPotionsRepeatCount(combo.potions.repeatCount)
    setSkillsEnabled(combo.skills.enabled)
    setHoldRightClick(combo.skills.holdRightClick)
    setSkillSteps(combo.skills.steps)
    setLabelStyle(combo.skills.labelStyle)
    setSkillsRepeatMode(combo.skills.repeatMode)
    setSkillsRepeatCount(combo.skills.repeatCount)
  }, [])

  // Apply imported combo to current config
  const applyCombo = useCallback((combo: { potions: typeof initial.current.potions; skills: typeof initial.current.skills }) => {
    setPotionsEnabled(combo.potions.enabled)
    setPotionKeys(combo.potions.keys)
    setCustomDelay(combo.potions.customDelay)
    setDelayMs(combo.potions.delayMs)
    setPotionsRepeatMode(combo.potions.repeatMode)
    setPotionsRepeatCount(combo.potions.repeatCount)
    setSkillsEnabled(combo.skills.enabled)
    setHoldRightClick(combo.skills.holdRightClick)
    setSkillSteps(combo.skills.steps)
    setLabelStyle(combo.skills.labelStyle)
    setSkillsRepeatMode(combo.skills.repeatMode)
    setSkillsRepeatCount(combo.skills.repeatCount)
  }, [])

  const reset = useCallback(() => {
    const defaults = makeDefaultSettings()
    setPotionsEnabled(defaults.current.potions.enabled)
    setPotionKeys(defaults.current.potions.keys)
    setCustomDelay(defaults.current.potions.customDelay)
    setDelayMs(defaults.current.potions.delayMs)
    setPotionsRepeatMode(defaults.current.potions.repeatMode)
    setPotionsRepeatCount(defaults.current.potions.repeatCount)
    setSkillsEnabled(defaults.current.skills.enabled)
    setHoldRightClick(defaults.current.skills.holdRightClick)
    setSkillSteps(defaults.current.skills.steps)
    setLabelStyle(defaults.current.skills.labelStyle)
    setSkillsRepeatMode(defaults.current.skills.repeatMode)
    setSkillsRepeatCount(defaults.current.skills.repeatCount)
    setHotkeys(defaults.hotkeys)
    clearSettings()
    toast("Settings reset to defaults")
  }, [])

  // Skill step operations
  const addSkillKeydown = useCallback(() => {
    setSkillSteps((prev) => [...prev, { id: crypto.randomUUID(), type: "keydown", key: "" }])
  }, [])

  const addSkillKeyup = useCallback(() => {
    setSkillSteps((prev) => [...prev, { id: crypto.randomUUID(), type: "keyup", key: "" }])
  }, [])

  const addSkillDelay = useCallback(() => {
    setSkillSteps((prev) => [...prev, { id: crypto.randomUUID(), type: "delay", ms: "100" }])
  }, [])

  const removeSkillStep = useCallback((id: string) => {
    setSkillSteps((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const moveSkillStepUp = useCallback((id: string) => {
    setSkillSteps((prev) => {
      const i = prev.findIndex((s) => s.id === id)
      if (i <= 0) return prev
      const next = [...prev]
      ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
      return next
    })
  }, [])

  const moveSkillStepDown = useCallback((id: string) => {
    setSkillSteps((prev) => {
      const i = prev.findIndex((s) => s.id === id)
      if (i < 0 || i >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
      return next
    })
  }, [])

  const duplicateSkillStep = useCallback((id: string) => {
    setSkillSteps((prev) => {
      const i = prev.findIndex((s) => s.id === id)
      if (i < 0) return prev
      const next = [...prev]
      next.splice(i + 1, 0, { ...next[i], id: crypto.randomUUID() })
      return next
    })
  }, [])

  const updateSkillStep = useCallback((id: string, patch: { key?: string; ms?: string }) => {
    setSkillSteps((prev) =>
      prev.map((s) => (s.id === id ? ({ ...s, ...patch } as SkillStep) : s)),
    )
  }, [])

  const buildSettings = useCallback(
    (): SettingsV3 => ({
      version: 3,
      current: {
        potions: {
          enabled: potionsEnabled,
          keys: potionKeys,
          customDelay,
          delayMs,
          repeatMode: potionsRepeatMode,
          repeatCount: potionsRepeatCount,
        },
        skills: {
          enabled: skillsEnabled,
          holdRightClick,
          steps: skillSteps,
          labelStyle,
          repeatMode: skillsRepeatMode,
          repeatCount: skillsRepeatCount,
        },
      },
      hotkeys,
    }),
    [
      potionsEnabled, potionKeys, customDelay, delayMs,
      potionsRepeatMode, potionsRepeatCount,
      skillsEnabled, holdRightClick, skillSteps, labelStyle,
      skillsRepeatMode, skillsRepeatCount,
      hotkeys,
    ],
  )

  useEffect(() => {
    saveSettings(buildSettings())
  }, [buildSettings])

  const potionsConfig = useMemo(
    () => ({
      keys: potionKeys,
      delayMs: !potionsDelayError && delayMs !== "" ? Number(delayMs) : MIN_DELAY,
      repeatMode: potionsRepeatMode,
      repeatCount: Math.max(MIN_REPEAT, Number(potionsRepeatCount) || MIN_REPEAT),
    }),
    [potionKeys, delayMs, potionsDelayError, potionsRepeatMode, potionsRepeatCount],
  )

  const skillsConfig = useMemo(
    () => ({
      holdRightClick,
      steps: skillSteps.map((s) => {
        if (s.type === "delay") {
          return { type: "delay" as const, ms: Math.max(0, Number(s.ms) || 0) }
        }
        return { type: s.type as "keydown" | "keyup", key: s.key.trim() }
      }),
      repeatMode: skillsRepeatMode,
      repeatCount: Math.max(MIN_REPEAT, Number(skillsRepeatCount) || MIN_REPEAT),
    }),
    [holdRightClick, skillSteps, skillsRepeatMode, skillsRepeatCount],
  )

  const hotkey = hotkeys.length > 0 ? hotkeys[0].hotkey : "F5"

  return {
    // Potions
    potionsEnabled, setPotionsEnabled,
    potionKeys, togglePotionKey,
    customDelay, setCustomDelayEnabled,
    delayMs, setDelayMs,
    potionsRepeatMode, setPotionsRepeatMode,
    potionsRepeatCount, setPotionsRepeatCount,
    potionsDelayError, potionsRepeatError, potionsCanRun,
    // Skills
    skillsEnabled, setSkillsEnabled,
    holdRightClick, setHoldRightClick,
    skillSteps, setSkillSteps,
    addSkillKeydown, addSkillKeyup, addSkillDelay,
    removeSkillStep, moveSkillStepUp, moveSkillStepDown,
    duplicateSkillStep, updateSkillStep,
    labelStyle, setLabelStyle,
    skillsRepeatMode, setSkillsRepeatMode,
    skillsRepeatCount, setSkillsRepeatCount,
    skillsRepeatError, skillsCanRun,
    // Hotkeys
    hotkeys,
    addHotkey, deleteHotkey, renameHotkey,
    updateHotkeyBinding, updateHotkeyPath,
    loadComboFromFile, applyCombo,
    // Global
    hotkey, canRun, reset,
    potionsConfig, skillsConfig,
    buildSettings,
  }
}
