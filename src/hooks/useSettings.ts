import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  DEFAULTS,
  MIN_DELAY,
  MIN_REPEAT,
  clearSettings,
  loadSettings,
  saveSettings,
  type PotionKey,
  type RepeatMode,
  type SettingsV2,
  type SkillStep,
} from "@/lib/settings"

export function useSettings() {
  const initial = loadSettings()

  const [potionsEnabled, setPotionsEnabled] = useState(initial.potions.enabled)
  const [potionKeys, setPotionKeys] = useState(initial.potions.keys)
  const [customDelay, setCustomDelay] = useState(initial.potions.customDelay)
  const [delayMs, setDelayMs] = useState(initial.potions.delayMs)
  const [potionsRepeatMode, setPotionsRepeatMode] = useState<RepeatMode>(initial.potions.repeatMode)
  const [potionsRepeatCount, setPotionsRepeatCount] = useState(initial.potions.repeatCount)

  const [skillsEnabled, setSkillsEnabled] = useState(initial.skills.enabled)
  const [skillSteps, setSkillSteps] = useState<SkillStep[]>(initial.skills.steps)
  const [skillsRepeatMode, setSkillsRepeatMode] = useState<RepeatMode>(initial.skills.repeatMode)
  const [skillsRepeatCount, setSkillsRepeatCount] = useState(initial.skills.repeatCount)

  const [hotkey, setHotkey] = useState(initial.hotkey)

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

  const addSkillKeydown = () => {
    setSkillSteps((prev) => [
      ...prev,
      { id: crypto.randomUUID(), type: "keydown", key: "" },
    ])
  }

  const addSkillKeyup = () => {
    setSkillSteps((prev) => [
      ...prev,
      { id: crypto.randomUUID(), type: "keyup", key: "" },
    ])
  }

  const addSkillDelay = () => {
    setSkillSteps((prev) => [
      ...prev,
      { id: crypto.randomUUID(), type: "delay", ms: "100" },
    ])
  }

  const removeSkillStep = (id: string) => {
    setSkillSteps((prev) => prev.filter((s) => s.id !== id))
  }

  const moveSkillStepUp = (id: string) => {
    setSkillSteps((prev) => {
      const i = prev.findIndex((s) => s.id === id)
      if (i <= 0) return prev
      const next = [...prev]
      ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
      return next
    })
  }

  const moveSkillStepDown = (id: string) => {
    setSkillSteps((prev) => {
      const i = prev.findIndex((s) => s.id === id)
      if (i < 0 || i >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
      return next
    })
  }

  const duplicateSkillStep = (id: string) => {
    setSkillSteps((prev) => {
      const i = prev.findIndex((s) => s.id === id)
      if (i < 0) return prev
      const clone = { ...prev[i], id: crypto.randomUUID() }
      const next = [...prev]
      next.splice(i + 1, 0, clone)
      return next
    })
  }

  const updateSkillStep = (id: string, patch: { key?: string; ms?: string }) => {
    setSkillSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } as SkillStep : s)),
    )
  }

  const applySettings = (s: SettingsV2) => {
    setPotionsEnabled(s.potions.enabled)
    setPotionKeys(s.potions.keys)
    setCustomDelay(s.potions.customDelay)
    setDelayMs(s.potions.delayMs)
    setPotionsRepeatMode(s.potions.repeatMode)
    setPotionsRepeatCount(s.potions.repeatCount)
    setSkillsEnabled(s.skills.enabled)
    setSkillSteps(s.skills.steps)
    setSkillsRepeatMode(s.skills.repeatMode)
    setSkillsRepeatCount(s.skills.repeatCount)
    setHotkey(s.hotkey)
  }

  const reset = () => {
    applySettings(DEFAULTS)
    clearSettings()
    toast("Settings reset to defaults")
  }

  const buildSettings = useCallback(
    (): SettingsV2 => ({
      version: 2,
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
        steps: skillSteps,
        repeatMode: skillsRepeatMode,
        repeatCount: skillsRepeatCount,
      },
      hotkey,
    }),
    [
      potionsEnabled,
      potionKeys,
      customDelay,
      delayMs,
      potionsRepeatMode,
      potionsRepeatCount,
      skillsEnabled,
      skillSteps,
      skillsRepeatMode,
      skillsRepeatCount,
      hotkey,
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
      steps: skillSteps.map((s) => {
        if (s.type === "delay") {
          return { type: "delay" as const, ms: Math.max(0, Number(s.ms) || 0) }
        }
        return {
          type: s.type as "keydown" | "keyup",
          key: s.key.trim(),
        }
      }),
      repeatMode: skillsRepeatMode,
      repeatCount: Math.max(MIN_REPEAT, Number(skillsRepeatCount) || MIN_REPEAT),
    }),
    [skillSteps, skillsRepeatMode, skillsRepeatCount],
  )

  return {
    potionsEnabled,
    setPotionsEnabled,
    potionKeys,
    togglePotionKey,
    customDelay,
    setCustomDelayEnabled,
    delayMs,
    setDelayMs,
    potionsRepeatMode,
    setPotionsRepeatMode,
    potionsRepeatCount,
    setPotionsRepeatCount,
    potionsDelayError,
    potionsRepeatError,
    potionsCanRun,
    skillsEnabled,
    setSkillsEnabled,
    skillSteps,
    setSkillSteps,
    addSkillKeydown,
    addSkillKeyup,
    addSkillDelay,
    removeSkillStep,
    moveSkillStepUp,
    moveSkillStepDown,
    duplicateSkillStep,
    updateSkillStep,
    skillsRepeatMode,
    setSkillsRepeatMode,
    skillsRepeatCount,
    setSkillsRepeatCount,
    skillsRepeatError,
    skillsCanRun,
    hotkey,
    setHotkey,
    canRun,
    reset,
    potionsConfig,
    skillsConfig,
    applySettings,
    buildSettings,
  }
}
