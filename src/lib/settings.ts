export const MIN_DELAY = 2
export const MIN_REPEAT = 1
export const STORAGE_KEY = "combo-macro-settings"

export type PotionKey = "q" | "w" | "e" | "r"
export type RepeatMode = "loop" | "count"
export type StepLabelStyle = "abbreviation" | "icon"

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
  holdRightClick: boolean
  steps: SkillStep[]
  labelStyle: StepLabelStyle
  repeatMode: RepeatMode
  repeatCount: string
}

export type Profile = {
  id: string
  name: string
  hotkey: string
  potions: PotionConfig
  skills: SkillConfig
}

export type SettingsV3 = {
  version: 3
  activeProfileId: string
  profiles: Profile[]
}

function defaultProfile(): Profile {
  return {
    id: crypto.randomUUID(),
    name: "Untitled",
    hotkey: "F5",
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
      holdRightClick: false,
      steps: [],
      labelStyle: "abbreviation",
      repeatMode: "loop",
      repeatCount: "1",
    },
  }
}

export function makeDefaultSettings(): SettingsV3 {
  const profile = defaultProfile()
  return {
    version: 3,
    activeProfileId: profile.id,
    profiles: [profile],
  }
}

export const DEFAULTS = makeDefaultSettings()

function profileFromV2(potions: PotionConfig, skills: SkillConfig, hotkey: string): Profile {
  return {
    id: crypto.randomUUID(),
    name: "Untitled",
    hotkey,
    potions,
    skills,
  }
}

export function loadSettings(): SettingsV3 {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw)

    // V3
    if (parsed?.version === 3) {
      const profiles: Profile[] = Array.isArray(parsed.profiles) ? parsed.profiles : []
      return {
        version: 3,
        activeProfileId: parsed.activeProfileId ?? profiles[0]?.id ?? DEFAULTS.activeProfileId,
        profiles: profiles.length > 0 ? profiles : [defaultProfile()],
      }
    }

    // V2
    if (parsed?.version === 2) {
      const potions: PotionConfig = {
        ...DEFAULTS.profiles[0].potions,
        ...parsed.potions,
        keys: { ...DEFAULTS.profiles[0].potions.keys, ...(parsed.potions?.keys ?? {}) },
      }
      const skills: SkillConfig = {
        ...DEFAULTS.profiles[0].skills,
        ...parsed.skills,
        steps: Array.isArray(parsed.skills?.steps) ? parsed.skills.steps : [],
      }
      const profile = profileFromV2(potions, skills, parsed.hotkey ?? "F5")
      return {
        version: 3,
        activeProfileId: profile.id,
        profiles: [profile],
      }
    }

    // V1
    const potions: PotionConfig = {
      ...DEFAULTS.profiles[0].potions,
      enabled: Boolean(parsed.autoPotions),
      keys: { ...DEFAULTS.profiles[0].potions.keys, ...((parsed.keys as Record<string, boolean>) ?? {}) },
      customDelay: Boolean(parsed.customDelay),
      delayMs: String(parsed.delayMs ?? MIN_DELAY),
      repeatMode: (parsed.repeatMode as RepeatMode) ?? "loop",
      repeatCount: String(parsed.repeatCount ?? "1"),
    }
    const profile = profileFromV2(potions, DEFAULTS.profiles[0].skills, parsed.hotkey ?? "F5")
    return {
      version: 3,
      activeProfileId: profile.id,
      profiles: [profile],
    }
  } catch {
    return DEFAULTS
  }
}

export function saveSettings(settings: SettingsV3) {
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

export function exportProfilesToString(profiles: Profile[]): string {
  return JSON.stringify({ version: 3, profiles }, null, 2)
}

export function importProfilesFromString(json: string): Profile[] {
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

  // V3 file with profiles array
  if (p.version === 3 && Array.isArray(p.profiles)) {
    return p.profiles as Profile[]
  }

  // V2 file — wrap single config into a profile
  if (p.version === 2) {
    const potions = p.potions as Record<string, unknown> | undefined
    const skills = p.skills as Record<string, unknown> | undefined
    return [
      {
        id: crypto.randomUUID(),
        name: String(p.name ?? "Imported"),
        hotkey: String(p.hotkey ?? "F5"),
        potions: {
          enabled: Boolean(potions?.enabled),
          keys: {
            q: Boolean((potions?.keys as Record<string, boolean>)?.q ?? true),
            w: Boolean((potions?.keys as Record<string, boolean>)?.w ?? true),
            e: Boolean((potions?.keys as Record<string, boolean>)?.e ?? true),
            r: Boolean((potions?.keys as Record<string, boolean>)?.r ?? true),
          },
          customDelay: Boolean(potions?.customDelay),
          delayMs: String(potions?.delayMs ?? MIN_DELAY),
          repeatMode: ((potions?.repeatMode as RepeatMode) ?? "loop"),
          repeatCount: String(potions?.repeatCount ?? "1"),
        },
        skills: {
          enabled: Boolean(skills?.enabled),
          holdRightClick: Boolean(skills?.holdRightClick),
          steps: Array.isArray(skills?.steps) ? (skills?.steps as SkillStep[]) : [],
          labelStyle: ((skills?.labelStyle as StepLabelStyle) ?? "abbreviation"),
          repeatMode: ((skills?.repeatMode as RepeatMode) ?? "loop"),
          repeatCount: String(skills?.repeatCount ?? "1"),
        },
      },
    ]
  }

  throw new Error("Unsupported profile format")
}
