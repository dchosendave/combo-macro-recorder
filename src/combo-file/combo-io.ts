import { defaultPotionConfig, defaultSkillConfig } from "@/shared/defaults"
import type { CurrentCombo, PotionConfig, PotionKey, RepeatMode, SkillConfig, SkillStep, StepLabelStyle } from "@/shared/types"

/** Serialize a combo to the versioned JSON file format (currently v4). */
export function exportComboToString(current: CurrentCombo): string {
  return JSON.stringify({ version: 4, potions: current.potions, skills: current.skills }, null, 2)
}

/** Coerces an unknown value to a plain record so malformed combo fields degrade to defaults. */
function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function booleanOr(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback
}

function inputStringOr(value: unknown, fallback: string) {
  return typeof value === "string"
    ? value
    : typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : fallback
}

function repeatModeOr(value: unknown, fallback: RepeatMode): RepeatMode {
  return value === "loop" || value === "count" ? value : fallback
}

function labelStyleOr(value: unknown, fallback: StepLabelStyle): StepLabelStyle {
  return value === "abbreviation" || value === "icon" ? value : fallback
}

function normalizePotionConfig(value: unknown): PotionConfig {
  const defaults = defaultPotionConfig()
  const source = asRecord(value)
  const sourceKeys = asRecord(source.keys)
  const keys = { ...defaults.keys }
  for (const key of Object.keys(keys) as PotionKey[]) {
    keys[key] = booleanOr(sourceKeys[key], defaults.keys[key])
  }
  return {
    enabled: booleanOr(source.enabled, defaults.enabled),
    keys,
    customDelay: booleanOr(source.customDelay, defaults.customDelay),
    delayMs: inputStringOr(source.delayMs, defaults.delayMs),
    repeatMode: repeatModeOr(source.repeatMode, defaults.repeatMode),
    repeatCount: inputStringOr(source.repeatCount, defaults.repeatCount),
  }
}

function normalizeSkillSteps(value: unknown): SkillStep[] {
  if (!Array.isArray(value)) return []
  const usedIds = new Set<string>()
  return value.map((raw, index) => {
    const step = asRecord(raw)
    const type = step.type
    if (type !== "keydown" && type !== "keyup" && type !== "delay") {
      throw new Error(`Invalid skill step at index ${index}: unsupported type`)
    }

    let id = typeof step.id === "string" ? step.id.trim() : ""
    if (!id || usedIds.has(id)) id = crypto.randomUUID()
    usedIds.add(id)

    if (step.disabled !== undefined && typeof step.disabled !== "boolean") {
      throw new Error(`Invalid skill step at index ${index}: disabled must be boolean`)
    }
    const disabled = typeof step.disabled === "boolean" ? { disabled: step.disabled } : {}

    if (type === "delay") {
      if (typeof step.ms !== "string" && !(typeof step.ms === "number" && Number.isFinite(step.ms))) {
        throw new Error(`Invalid skill step at index ${index}: delay ms must be a string or number`)
      }
      return { id, type, ms: String(step.ms), ...disabled }
    }
    if (typeof step.key !== "string") {
      throw new Error(`Invalid skill step at index ${index}: key must be a string`)
    }
    return { id, type, key: step.key, ...disabled }
  })
}

function normalizeSkillConfig(value: unknown): SkillConfig {
  const defaults = defaultSkillConfig()
  const source = asRecord(value)
  const playbackSpeed = inputStringOr(source.playbackSpeed, "1")
  return {
    enabled: booleanOr(source.enabled, defaults.enabled),
    holdRightClick: booleanOr(source.holdRightClick, defaults.holdRightClick),
    steps: normalizeSkillSteps(source.steps),
    labelStyle: labelStyleOr(source.labelStyle, defaults.labelStyle),
    repeatMode: repeatModeOr(source.repeatMode, defaults.repeatMode),
    repeatCount: inputStringOr(source.repeatCount, defaults.repeatCount),
    ...(playbackSpeed === "1" ? {} : { playbackSpeed }),
  }
}

/** Parse a combo file. Accepts v2-v4; parsed values are merged over defaults, so missing fields degrade gracefully. Throws on invalid JSON or unknown versions. */
export function importComboFromString(json: string): CurrentCombo {
  let parsed: unknown
  try { parsed = JSON.parse(json) } catch { throw new Error("Invalid JSON") }

  if (!parsed || typeof parsed !== "object") throw new Error("Invalid format")

  const p = parsed as Record<string, unknown>

  if (p.version === 2 || p.version === 3 || p.version === 4) {
    return {
      potions: normalizePotionConfig(p.potions),
      skills: normalizeSkillConfig(p.skills),
    }
  }

  throw new Error("Unsupported format")
}
