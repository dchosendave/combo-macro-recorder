import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  MIN_DELAY,
  MIN_REPEAT,
  clearSettings,
  loadSettings,
  makeDefaultSettings,
  saveSettings,
  type PotionConfig,
  type PotionKey,
  type Profile,
  type RepeatMode,
  type SettingsV3,
  type SkillConfig,
  type SkillStep,
  type StepLabelStyle,
} from "@/lib/settings"

export function useSettings() {
  const initial = loadSettings()

  const [activeProfileId, setActiveProfileId] = useState(initial.activeProfileId)
  const [profiles, setProfiles] = useState<Profile[]>(initial.profiles)

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId) ?? profiles[0],
    [profiles, activeProfileId],
  )

  const updateActivePotions = useCallback(
    (patch: Partial<PotionConfig>) => {
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === activeProfileId ? { ...p, potions: { ...p.potions, ...patch } } : p,
        ),
      )
    },
    [activeProfileId],
  )

  const updateActiveSkills = useCallback(
    (patch: Partial<SkillConfig>) => {
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === activeProfileId ? { ...p, skills: { ...p.skills, ...patch } } : p,
        ),
      )
    },
    [activeProfileId],
  )

  // --- Potions (derived from active profile) ---

  const potionsEnabled = activeProfile.potions.enabled
  const potionKeys = activeProfile.potions.keys
  const customDelay = activeProfile.potions.customDelay
  const delayMs = activeProfile.potions.delayMs
  const potionsRepeatMode = activeProfile.potions.repeatMode
  const potionsRepeatCount = activeProfile.potions.repeatCount

  const potionsDelayError =
    customDelay && delayMs !== "" && Number(delayMs) < MIN_DELAY
  const potionsRepeatError =
    potionsRepeatMode === "count" &&
    (potionsRepeatCount === "" || Number(potionsRepeatCount) < MIN_REPEAT)
  const anyPotionKeyEnabled = Object.values(potionKeys).some(Boolean)
  const potionsCanRun =
    potionsEnabled && anyPotionKeyEnabled && !potionsDelayError && !potionsRepeatError

  const setPotionsEnabled = (v: boolean) => updateActivePotions({ enabled: v })
  const setPotionsRepeatMode = (v: RepeatMode) => updateActivePotions({ repeatMode: v })
  const setPotionsRepeatCount = (v: string) => updateActivePotions({ repeatCount: v })

  const togglePotionKey = (key: PotionKey) => {
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === activeProfileId
          ? { ...p, potions: { ...p.potions, keys: { ...p.potions.keys, [key]: !p.potions.keys[key] } } }
          : p,
      ),
    )
  }

  const setCustomDelayEnabled = (enabled: boolean) => {
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === activeProfileId
          ? { ...p, potions: { ...p.potions, customDelay: enabled, delayMs: enabled ? p.potions.delayMs : String(MIN_DELAY) } }
          : p,
      ),
    )
  }

  const setDelayMs = (v: string) => updateActivePotions({ delayMs: v })

  // --- Skills (derived from active profile) ---

  const skillsEnabled = activeProfile.skills.enabled
  const holdRightClick = activeProfile.skills.holdRightClick
  const skillSteps = activeProfile.skills.steps
  const labelStyle = activeProfile.skills.labelStyle
  const skillsRepeatMode = activeProfile.skills.repeatMode
  const skillsRepeatCount = activeProfile.skills.repeatCount

  const skillsRepeatError =
    skillsRepeatMode === "count" &&
    (skillsRepeatCount === "" || Number(skillsRepeatCount) < MIN_REPEAT)
  const skillsCanRun =
    skillsEnabled &&
    skillSteps.some((s) => s.type === "keydown") &&
    !skillsRepeatError

  const canRun = potionsCanRun || skillsCanRun

  const setSkillsEnabled = (v: boolean) => updateActiveSkills({ enabled: v })
  const setHoldRightClick = (v: boolean) => updateActiveSkills({ holdRightClick: v })
  const setLabelStyle = (v: StepLabelStyle) => updateActiveSkills({ labelStyle: v })
  const setSkillsRepeatMode = (v: RepeatMode) => updateActiveSkills({ repeatMode: v })
  const setSkillsRepeatCount = (v: string) => updateActiveSkills({ repeatCount: v })

  const setSkillSteps = (steps: SkillStep[]) => updateActiveSkills({ steps })

  const addSkillKeydown = () =>
    setSkillSteps([...skillSteps, { id: crypto.randomUUID(), type: "keydown", key: "" }])

  const addSkillKeyup = () =>
    setSkillSteps([...skillSteps, { id: crypto.randomUUID(), type: "keyup", key: "" }])

  const addSkillDelay = () =>
    setSkillSteps([...skillSteps, { id: crypto.randomUUID(), type: "delay", ms: "100" }])

  const removeSkillStep = (id: string) =>
    setSkillSteps(skillSteps.filter((s) => s.id !== id))

  const moveSkillStepUp = (id: string) => {
    const i = skillSteps.findIndex((s) => s.id === id)
    if (i <= 0) return
    const next = [...skillSteps]
    ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
    setSkillSteps(next)
  }

  const moveSkillStepDown = (id: string) => {
    const i = skillSteps.findIndex((s) => s.id === id)
    if (i < 0 || i >= skillSteps.length - 1) return
    const next = [...skillSteps]
    ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
    setSkillSteps(next)
  }

  const duplicateSkillStep = (id: string) => {
    const i = skillSteps.findIndex((s) => s.id === id)
    if (i < 0) return
    const next = [...skillSteps]
    next.splice(i + 1, 0, { ...next[i], id: crypto.randomUUID() })
    setSkillSteps(next)
  }

  const updateSkillStep = (id: string, patch: { key?: string; ms?: string }) => {
    setSkillSteps(
      skillSteps.map((s) => (s.id === id ? ({ ...s, ...patch } as SkillStep) : s)),
    )
  }

  // --- Profile CRUD ---

  const addProfile = () => {
    setProfiles((prev) => {
      const name = `Profile ${prev.length + 1}`
      const newProfile: Profile = {
        id: crypto.randomUUID(),
        name,
        hotkey: "F5",
        potions: { ...activeProfile.potions },
        skills: { ...activeProfile.skills, steps: [...activeProfile.skills.steps.map((s) => ({ ...s }))] },
      }
      return [...prev, newProfile]
    })
  }

  const deleteProfile = (id: string) => {
    setProfiles((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((p) => p.id !== id)
    })
    if (activeProfileId === id) {
      const remaining = profiles.filter((p) => p.id !== id)
      if (remaining.length > 0) setActiveProfileId(remaining[0].id)
    }
  }

  const renameProfile = (id: string, name: string) => {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)))
  }

  const updateProfileHotkey = (id: string, hotkey: string) => {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, hotkey } : p)))
  }

  const setProfilesAll = (newProfiles: Profile[]) => {
    setProfiles(newProfiles)
    if (newProfiles.length > 0) setActiveProfileId(newProfiles[0].id)
  }

  // --- Global ---

  const hotkey = activeProfile.hotkey

  const setHotkey = (key: string) => updateProfileHotkey(activeProfileId, key)

  const reset = () => {
    const defaults = makeDefaultSettings()
    setActiveProfileId(defaults.activeProfileId)
    setProfiles(defaults.profiles)
    clearSettings()
    toast("Settings reset to defaults")
  }

  const buildSettings = useCallback(
    (): SettingsV3 => ({
      version: 3,
      activeProfileId,
      profiles,
    }),
    [activeProfileId, profiles],
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

  return {
    // Active profile
    activeProfile,
    activeProfileId,
    setActiveProfileId,
    profiles,
    // Profile CRUD
    addProfile,
    deleteProfile,
    renameProfile,
    updateProfileHotkey,
    setProfilesAll,
    // Potions (derived)
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
    // Skills (derived)
    skillsEnabled,
    setSkillsEnabled,
    holdRightClick,
    setHoldRightClick,
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
    labelStyle,
    setLabelStyle,
    skillsRepeatMode,
    setSkillsRepeatMode,
    skillsRepeatCount,
    setSkillsRepeatCount,
    skillsRepeatError,
    skillsCanRun,
    // Global
    hotkey,
    setHotkey,
    canRun,
    reset,
    potionsConfig,
    skillsConfig,
    buildSettings,
  }
}
