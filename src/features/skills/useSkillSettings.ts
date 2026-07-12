import { useCallback, useMemo, useState } from "react"
import { MIN_REPEAT } from "@/shared/lib/defaults"
import type {
  RepeatMode,
  SkillConfig,
  SkillStep,
  StepLabelStyle,
} from "@/shared/lib/types"

export function useSkillSettings(initial: SkillConfig) {
  const [skillsEnabled, setSkillsEnabled] = useState(initial.enabled)
  const [holdRightClick, setHoldRightClick] = useState(initial.holdRightClick)
  const [skillSteps, setSkillSteps] = useState<SkillStep[]>(initial.steps)
  const [labelStyle, setLabelStyle] = useState<StepLabelStyle>(initial.labelStyle)
  const [skillsRepeatMode, setSkillsRepeatMode] = useState<RepeatMode>(initial.repeatMode)
  const [skillsRepeatCount, setSkillsRepeatCount] = useState(initial.repeatCount)

  const skillsRepeatError =
    skillsRepeatMode === "count" &&
    (skillsRepeatCount === "" || Number(skillsRepeatCount) < MIN_REPEAT)
  const skillsCanRun =
    skillsEnabled &&
    skillSteps.some((s) => s.type === "keydown") &&
    !skillsRepeatError

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
  }, [])

  const persisted = useMemo<SkillConfig>(
    () => ({
      enabled: skillsEnabled,
      holdRightClick,
      steps: skillSteps,
      labelStyle,
      repeatMode: skillsRepeatMode,
      repeatCount: skillsRepeatCount,
    }),
    [skillsEnabled, holdRightClick, skillSteps, labelStyle, skillsRepeatMode, skillsRepeatCount],
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
    apply,
    persisted,
    skillsConfig,
  }
}
