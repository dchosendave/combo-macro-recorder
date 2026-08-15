import { MAX_REPEAT, MIN_DELAY, MIN_REPEAT } from "@/shared/defaults"
import type { PotionConfig, PotionKey, RepeatMode, SkillConfig } from "@/shared/types"
import { analyzeSkillSteps, normalizeSkillKey } from "@/shared/skill-keys"

/**
 * Run-config derivation — the single source of truth for "can this channel
 * run?" and for the delay/repeat clamps sent to the backend.
 *
 * Used by BOTH the live tabs (`usePotionSettings`/`useSkillSettings`) and the
 * file-loaded path (`toRunnerInputs`), so a combo opened from a file behaves
 * identically to one edited in the tabs. Do not re-implement these rules
 * anywhere else — import the derivations.
 */

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

export type PotionRunDerivation = {
  canRun: boolean
  delayError: boolean
  repeatError: boolean
  config: PotionsRunConfig
}

export type SkillRunDerivation = {
  canRun: boolean
  repeatError: boolean
  keyError: boolean
  unmatchedKeydowns: string[]
  config: SkillsRunConfig
}

export function normalizePlaybackSpeed(value: string | undefined): number {
  const speed = Number(value)
  return Number.isFinite(speed) ? Math.min(4, Math.max(0.1, speed)) : 1
}

/**
 * Derives potions run eligibility + backend config.
 * Rules: runs if `enabled && any key &&` no delay error (`customDelay &&
 * delayMs < MIN_DELAY`) `&&` no repeat error. Invalid delays fall back to
 * `MIN_DELAY`; repeat counts clamp to `[MIN_REPEAT, MAX_REPEAT]`.
 */
export function derivePotionRun(p: PotionConfig): PotionRunDerivation {
  const delayError = p.customDelay && p.delayMs !== "" && Number(p.delayMs) < MIN_DELAY
  const repeatError =
    p.repeatMode === "count" &&
    (p.repeatCount === "" || Number(p.repeatCount) < MIN_REPEAT)
  const anyPotionKeyEnabled = Object.values(p.keys).some(Boolean)

  const config: PotionsRunConfig = {
    keys: p.keys,
    delayMs: !delayError && p.delayMs !== "" ? Number(p.delayMs) : MIN_DELAY,
    repeatMode: p.repeatMode,
    repeatCount: Math.min(MAX_REPEAT, Math.max(MIN_REPEAT, Number(p.repeatCount) || MIN_REPEAT)),
  }

  return {
    canRun: p.enabled && anyPotionKeyEnabled && !delayError && !repeatError,
    delayError,
    repeatError,
    config,
  }
}

/**
 * Derives skills run eligibility + backend config.
 * Rules: runs if `enabled && ≥1 keydown step &&` no repeat error.
 * Delay steps clamp to ≥0 ms; repeat counts clamp to `[MIN_REPEAT, MAX_REPEAT]`.
 */
export function deriveSkillRun(s: SkillConfig): SkillRunDerivation {
  const repeatError =
    s.repeatMode === "count" &&
    (s.repeatCount === "" || Number(s.repeatCount) < MIN_REPEAT)
  const enabledSteps = s.steps.filter((step) => !step.disabled)
  const playbackSpeed = normalizePlaybackSpeed(s.playbackSpeed)
  const analysis = analyzeSkillSteps(enabledSteps)
  const keyError = analysis.invalidStepIds.length > 0

  const config: SkillsRunConfig = {
    holdRightClick: s.holdRightClick,
    steps: enabledSteps.map((step) =>
      step.type === "delay"
        ? { type: "delay" as const, ms: Math.round(Math.max(0, Number(step.ms) || 0) / playbackSpeed) }
        : { type: step.type, key: normalizeSkillKey(step.key) ?? step.key.trim() },
    ),
    repeatMode: s.repeatMode,
    repeatCount: Math.min(MAX_REPEAT, Math.max(MIN_REPEAT, Number(s.repeatCount) || MIN_REPEAT)),
  }

  return {
    canRun: s.enabled && enabledSteps.some((step) => step.type === "keydown") && !repeatError && !keyError,
    repeatError,
    keyError,
    unmatchedKeydowns: analysis.unmatchedKeydowns,
    config,
  }
}
