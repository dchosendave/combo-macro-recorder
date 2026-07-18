import { MAX_REPEAT, MIN_DELAY, MIN_REPEAT } from "@/shared/defaults"
import type { CurrentCombo, PotionKey, RepeatMode } from "@/shared/types"

export type PotionsRunConfig = {
  keys: Record<PotionKey, boolean>
  delayMs: number
  repeatMode: RepeatMode
  repeatCount: number
}

export type SkillStepRunConfig =
  | { type: "keydown" | "keyup"; key: string }
  | { type: "delay"; ms: number }

export type SkillsRunConfig = {
  holdRightClick: boolean
  steps: SkillStepRunConfig[]
  repeatMode: RepeatMode
  repeatCount: number
}

export type RunnerInputs = {
  potionsConfig: PotionsRunConfig
  potionsCanRun: boolean
  skillsConfig: SkillsRunConfig
  skillsCanRun: boolean
}

/**
 * Derives the backend run configs + "can run" gates from a combo.
 * Mirrors the exact validation used for the live UI in useSettings, so a
 * file-loaded combo behaves identically to one edited in the tabs.
 */
export function toRunnerInputs(combo: CurrentCombo): RunnerInputs {
  const p = combo.potions
  const potionsDelayError =
    p.customDelay && p.delayMs !== "" && Number(p.delayMs) < MIN_DELAY
  const potionsRepeatError =
    p.repeatMode === "count" &&
    (p.repeatCount === "" || Number(p.repeatCount) < MIN_REPEAT)
  const anyPotionKeyEnabled = Object.values(p.keys).some(Boolean)
  const potionsCanRun =
    p.enabled && anyPotionKeyEnabled && !potionsDelayError && !potionsRepeatError

  const potionsConfig: PotionsRunConfig = {
    keys: p.keys,
    delayMs: !potionsDelayError && p.delayMs !== "" ? Number(p.delayMs) : MIN_DELAY,
    repeatMode: p.repeatMode,
    repeatCount: Math.min(MAX_REPEAT, Math.max(MIN_REPEAT, Number(p.repeatCount) || MIN_REPEAT)),
  }

  const s = combo.skills
  const skillsRepeatError =
    s.repeatMode === "count" &&
    (s.repeatCount === "" || Number(s.repeatCount) < MIN_REPEAT)
  const skillsCanRun =
    s.enabled && s.steps.some((step) => step.type === "keydown") && !skillsRepeatError

  const skillsConfig: SkillsRunConfig = {
    holdRightClick: s.holdRightClick,
    steps: s.steps.map((step) =>
      step.type === "delay"
        ? { type: "delay" as const, ms: Math.max(0, Number(step.ms) || 0) }
        : { type: step.type, key: step.key.trim() },
    ),
    repeatMode: s.repeatMode,
    repeatCount: Math.min(MAX_REPEAT, Math.max(MIN_REPEAT, Number(s.repeatCount) || MIN_REPEAT)),
  }

  return { potionsConfig, potionsCanRun, skillsConfig, skillsCanRun }
}
