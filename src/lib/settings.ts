export const MIN_DELAY = 2
export const MIN_REPEAT = 1
export const STORAGE_KEY = "combo-macro-settings"

export type PotionKey = "q" | "w" | "e" | "r"
export type RepeatMode = "loop" | "count"

export type SkillStep =
  | { id: string; type: "keydown"; key: string }
  | { id: string; type: "keyup"; key: string }
  | { id: string; type: "delay"; ms: string }

export type PotionConfig = {
  enabled: boolean
  keys: Record<PotionKey, boolean>
  customDelay: boolean
  delayMs: string
  repeatMode: RepeatMode
  repeatCount: string
}

export type SkillConfig = {
  enabled: boolean
  steps: SkillStep[]
  repeatMode: RepeatMode
  repeatCount: string
}

export type SettingsV2 = {
  version: 2
  potions: PotionConfig
  skills: SkillConfig
  hotkey: string
}

export const DEFAULTS: SettingsV2 = {
  version: 2,
  potions: {
    enabled: false,
    keys: { q: true, w: true, e: true, r: true },
    customDelay: false,
    delayMs: String(MIN_DELAY),
    repeatMode: "loop",
    repeatCount: "1",
  },
  skills: {
    enabled: false,
    steps: [],
    repeatMode: "loop",
    repeatCount: "1",
  },
  hotkey: "F5",
}

function migrateFromV1(parsed: Record<string, unknown>): SettingsV2 {
  return {
    version: 2,
    potions: {
      enabled: Boolean(parsed.autoPotions),
      keys: {
        ...DEFAULTS.potions.keys,
        ...((parsed.keys as Record<string, boolean>) ?? {}),
      },
      customDelay: Boolean(parsed.customDelay),
      delayMs: String(parsed.delayMs ?? DEFAULTS.potions.delayMs),
      repeatMode: (parsed.repeatMode as RepeatMode) ?? DEFAULTS.potions.repeatMode,
      repeatCount: String(parsed.repeatCount ?? DEFAULTS.potions.repeatCount),
    },
    skills: DEFAULTS.skills,
    hotkey: String(parsed.hotkey ?? DEFAULTS.hotkey),
  }
}

export function loadSettings(): SettingsV2 {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw)
    if (parsed?.version === 2) {
      return {
        potions: {
          ...DEFAULTS.potions,
          ...parsed.potions,
          keys: {
            ...DEFAULTS.potions.keys,
            ...(parsed.potions?.keys ?? {}),
          },
        },
        skills: {
          ...DEFAULTS.skills,
          ...parsed.skills,
          steps: Array.isArray(parsed.skills?.steps) ? parsed.skills.steps : [],
        },
        hotkey: parsed.hotkey ?? DEFAULTS.hotkey,
        version: 2,
      }
    }
    return migrateFromV1(parsed)
  } catch {
    return DEFAULTS
  }
}

export function saveSettings(settings: SettingsV2) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function clearSettings() {
  localStorage.removeItem(STORAGE_KEY)
}

export function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`
}

const SPECIAL_ACCELERATORS: Record<string, string> = {
  " ": "Space",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Escape: "Escape",
  Enter: "Enter",
  Tab: "Tab",
  Backspace: "Backspace",
  Delete: "Delete",
}

export function toAccelerator(key: string): string {
  if (/^F\d{1,2}$/.test(key)) return key
  if (key.length === 1) {
    if (/[a-zA-Z]/.test(key)) return key.toUpperCase()
    if (/[0-9]/.test(key)) return key
  }
  return SPECIAL_ACCELERATORS[key] ?? key
}

export type ExportedProfile = {
  version: 2
  name: string
  potions: PotionConfig
  skills: SkillConfig
  hotkey: string
}

export function exportProfileToString(settings: SettingsV2, name = "My Profile"): string {
  const profile: ExportedProfile = {
    version: 2,
    name,
    potions: settings.potions,
    skills: settings.skills,
    hotkey: settings.hotkey,
  }
  return JSON.stringify(profile, null, 2)
}

export function importProfileFromString(
  json: string,
  currentSettings: SettingsV2,
): { settings: SettingsV2; name: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error("Invalid JSON file")
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid profile format")
  }

  const p = parsed as Record<string, unknown>

  if (p.version !== 2) {
    throw new Error(`Unsupported profile version: ${p.version}`)
  }

  const name = String(p.name ?? "Imported Profile")

  const importedPotions = p.potions as Record<string, unknown> | undefined
  const importedSkills = p.skills as Record<string, unknown> | undefined

  const potions: PotionConfig = importedPotions
    ? {
        enabled: Boolean(importedPotions.enabled),
        keys: {
          ...DEFAULTS.potions.keys,
          ...((importedPotions.keys as Record<string, boolean>) ?? {}),
        },
        customDelay: Boolean(importedPotions.customDelay),
        delayMs: String(importedPotions.delayMs ?? DEFAULTS.potions.delayMs),
        repeatMode: ((importedPotions.repeatMode as RepeatMode) ?? DEFAULTS.potions.repeatMode),
        repeatCount: String(importedPotions.repeatCount ?? DEFAULTS.potions.repeatCount),
      }
    : currentSettings.potions

  const skills: SkillConfig = importedSkills
    ? {
        enabled: Boolean(importedSkills.enabled),
        steps: Array.isArray(importedSkills.steps) ? (importedSkills.steps as SkillStep[]) : [],
        repeatMode: ((importedSkills.repeatMode as RepeatMode) ?? DEFAULTS.skills.repeatMode),
        repeatCount: String(importedSkills.repeatCount ?? DEFAULTS.skills.repeatCount),
      }
    : currentSettings.skills

  return {
    settings: {
      version: 2,
      potions,
      skills,
      hotkey: String(p.hotkey ?? currentSettings.hotkey),
    },
    name,
  }
}
