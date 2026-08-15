import { useCallback, useMemo, useState } from "react"
import { useUndo } from "@/shared/use-undo"
import { deriveSkillRun } from "@/shared/run-validation"
import type {
  RepeatMode,
  SkillConfig,
  SkillStep,
  StepLabelStyle,
} from "@/shared/types"

export function useSkillSettings(initial: SkillConfig) {
  const [skillsEnabled, setSkillsEnabled] = useState(initial.enabled)
  const [holdRightClick, setHoldRightClick] = useState(initial.holdRightClick)
  const {
    value: skillSteps,
    setValue: setSkillSteps,
    undo: undoSteps,
    redo: redoSteps,
    canUndo,
    canRedo,
  } = useUndo<SkillStep[]>(initial.steps)
  const [labelStyle, setLabelStyle] = useState<StepLabelStyle>(initial.labelStyle)
  const [skillsRepeatMode, setSkillsRepeatMode] = useState<RepeatMode>(initial.repeatMode)
  const [skillsRepeatCount, setSkillsRepeatCount] = useState(initial.repeatCount)
  const [playbackSpeed, setPlaybackSpeed] = useState(initial.playbackSpeed ?? "1")

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

  const apply = useCallback((config: SkillConfig) => {
    setSkillsEnabled(config.enabled)
    setHoldRightClick(config.holdRightClick)
    setSkillSteps(config.steps)
    setLabelStyle(config.labelStyle)
    setSkillsRepeatMode(config.repeatMode)
    setSkillsRepeatCount(config.repeatCount)
    setPlaybackSpeed(config.playbackSpeed ?? "1")
  }, [])

  const persisted = useMemo<SkillConfig>(
    () => ({
      enabled: skillsEnabled,
      holdRightClick,
      steps: skillSteps,
      labelStyle,
      repeatMode: skillsRepeatMode,
      repeatCount: skillsRepeatCount,
      ...(playbackSpeed === "1" ? {} : { playbackSpeed }),
    }),
    [skillsEnabled, holdRightClick, skillSteps, labelStyle, skillsRepeatMode, skillsRepeatCount, playbackSpeed],
  )

  // Can-run gating + backend config come from the shared derivation, so
  // tabs-edited combos and file-loaded combos behave identically.
  const derivation = useMemo(() => deriveSkillRun(persisted), [persisted])
  const skillsRepeatError = derivation.repeatError
  const skillsKeyError = derivation.keyError
  const unmatchedKeydowns = derivation.unmatchedKeydowns
  const skillsCanRun = derivation.canRun
  const skillsConfig = derivation.config

  return {
    skillsEnabled, setSkillsEnabled,
    holdRightClick, setHoldRightClick,
    skillSteps, setSkillSteps,
    addSkillKeydown, addSkillKeyup, addSkillDelay,
    removeSkillStep, moveSkillStepUp, moveSkillStepDown,
    duplicateSkillStep, updateSkillStep,
    labelStyle, setLabelStyle,
    skillsRepeatMode, setSkillsRepeatMode,
    skillsRepeatCount, setSkillsRepeatCount,
    playbackSpeed, setPlaybackSpeed,
    skillsRepeatError, skillsKeyError, unmatchedKeydowns, skillsCanRun,
    apply,
    persisted,
    skillsConfig,
    undoSteps,
    redoSteps,
    canUndo,
    canRedo,
  }
}
