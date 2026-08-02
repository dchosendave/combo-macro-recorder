import { defaultPotionConfig, defaultSkillConfig } from "@/shared/defaults"
import type { CurrentCombo, SkillStep } from "@/shared/types"

/** Serialize a combo to the versioned JSON file format (currently v3). */
export function exportComboToString(current: CurrentCombo): string {
  return JSON.stringify({ version: 3, potions: current.potions, skills: current.skills }, null, 2)
}

/** Parse a combo file. Accepts v2/v3; parsed values are merged over defaults, so missing fields degrade gracefully. Throws on invalid JSON or unknown versions. */
export function importComboFromString(json: string): CurrentCombo {
  let parsed: unknown
  try { parsed = JSON.parse(json) } catch { throw new Error("Invalid JSON") }

  if (!parsed || typeof parsed !== "object") throw new Error("Invalid format")

  const p = parsed as Record<string, unknown>

  // V3 combo format
  if (p.version === 3) {
    return {
      potions: {
        ...defaultPotionConfig(),
        ...(p.potions as Record<string, unknown> ?? {}),
        keys: { ...defaultPotionConfig().keys, ...((p.potions as Record<string, unknown>)?.keys as Record<string, boolean> ?? {}) },
      },
      skills: {
        ...defaultSkillConfig(),
        ...(p.skills as Record<string, unknown> ?? {}),
        steps: Array.isArray((p.skills as Record<string, unknown>)?.steps) ? (p.skills as Record<string, unknown>).steps as SkillStep[] : [],
      },
    }
  }

  // V2 format
  if (p.version === 2) {
    const potions = p.potions as Record<string, unknown> | undefined
    const skills = p.skills as Record<string, unknown> | undefined
    return {
      potions: {
        ...defaultPotionConfig(),
        ...(potions ?? {}),
        keys: { ...defaultPotionConfig().keys, ...((potions?.keys as Record<string, boolean>) ?? {}) },
      },
      skills: {
        ...defaultSkillConfig(),
        ...(skills ?? {}),
        steps: Array.isArray(skills?.steps) ? skills!.steps as SkillStep[] : [],
      },
    }
  }

  throw new Error("Unsupported format")
}
