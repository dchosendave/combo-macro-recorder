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

export type HotkeyBinding = {
  id: string
  name: string
  hotkey: string
  comboPath: string
}

export type CurrentCombo = {
  potions: PotionConfig
  skills: SkillConfig
}

export type SettingsV3 = {
  version: 3
  current: CurrentCombo
  hotkeys: HotkeyBinding[]
}

function defaultPotionConfig(): PotionConfig {
  return {
    enabled: false,
    keys: { q: true, w: true, e: true, r: true },
    customDelay: false,
    delayMs: String(MIN_DELAY),
    repeatMode: "loop",
    repeatCount: "1",
  }
}

function defaultSkillConfig(): SkillConfig {
  return {
    enabled: false,
    holdRightClick: false,
    steps: [],
    labelStyle: "abbreviation",
    repeatMode: "loop",
    repeatCount: "1",
  }
}

function defaultHotkeyBinding(): HotkeyBinding {
  return {
    id: crypto.randomUUID(),
    name: "Untitled",
    hotkey: "F5",
    comboPath: "",
  }
}

export const DEFAULTS: SettingsV3 = {
  version: 3,
  current: {
    potions: defaultPotionConfig(),
    skills: defaultSkillConfig(),
  },
  hotkeys: [defaultHotkeyBinding()],
}

export function makeDefaultSettings(): SettingsV3 {
  const binding = defaultHotkeyBinding()
  return {
    version: 3,
    current: {
      potions: defaultPotionConfig(),
      skills: defaultSkillConfig(),
    },
    hotkeys: [binding],
  }
}

export function loadSettings(): SettingsV3 {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw)

    if (parsed?.version === 3) {
      return {
        version: 3,
        current: {
          potions: {
            ...defaultPotionConfig(),
            ...parsed.current?.potions,
            keys: { ...defaultPotionConfig().keys, ...(parsed.current?.potions?.keys ?? {}) },
          },
          skills: {
            ...defaultSkillConfig(),
            ...parsed.current?.skills,
            steps: Array.isArray(parsed.current?.skills?.steps) ? parsed.current.skills.steps : [],
          },
        },
        hotkeys: Array.isArray(parsed.hotkeys) && parsed.hotkeys.length > 0
          ? parsed.hotkeys
          : [defaultHotkeyBinding()],
      }
    }

    // V2
    if (parsed?.version === 2) {
      return {
        version: 3,
        current: {
          potions: {
            ...defaultPotionConfig(),
            ...parsed.potions,
            keys: { ...defaultPotionConfig().keys, ...(parsed.potions?.keys ?? {}) },
          },
          skills: {
            ...defaultSkillConfig(),
            ...parsed.skills,
            steps: Array.isArray(parsed.skills?.steps) ? parsed.skills.steps : [],
          },
        },
        hotkeys: [
          {
            id: crypto.randomUUID(),
            name: "Untitled",
            hotkey: parsed.hotkey ?? "F5",
            comboPath: "",
          },
        ],
      }
    }

    // V1
    const p = defaultHotkeyBinding()
    return {
      version: 3,
      current: {
        potions: {
          ...defaultPotionConfig(),
          enabled: Boolean(parsed.autoPotions),
          keys: { ...defaultPotionConfig().keys, ...((parsed.keys as Record<string, boolean>) ?? {}) },
          customDelay: Boolean(parsed.customDelay),
          delayMs: String(parsed.delayMs ?? MIN_DELAY),
          repeatMode: (parsed.repeatMode as RepeatMode) ?? "loop",
          repeatCount: String(parsed.repeatCount ?? "1"),
        },
        skills: defaultSkillConfig(),
      },
      hotkeys: [{ ...p, hotkey: parsed.hotkey ?? "F5" }],
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

export function codeToShortcut(code: string): string {
  if (/^F(\d{1,2})$/.test(code)) return code

  if (code.startsWith("Key")) return code.slice(3)
  if (code.startsWith("Digit")) return code.slice(5)
  if (code.startsWith("Numpad")) return code.slice(6)

  const codeNames: Record<string, string> = {
    ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right",
    Backquote: "Backquote", Backslash: "Backslash",
    BracketLeft: "BracketLeft", BracketRight: "BracketRight",
    Comma: "Comma", Period: "Period", Slash: "Slash",
    Semicolon: "Semicolon", Quote: "Quote",
    Minus: "Minus", Equal: "Equal",
    Space: "Space", Tab: "Tab", Enter: "Enter",
    Backspace: "Backspace", Delete: "Delete", Escape: "Escape",
    Home: "Home", End: "End",
    PageUp: "PageUp", PageDown: "PageDown",
    Insert: "Insert", CapsLock: "CapsLock",
  }

  return codeNames[code] ?? code
}

export function codeToLabel(code: string): string {
  if (code.startsWith("Key")) return code.slice(3)
  if (code.startsWith("Digit")) return code.slice(5)
  if (code.startsWith("Numpad")) return `Num${code.slice(6)}`

  const labels: Record<string, string> = {
    ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
    Backquote: "`", Backslash: "\\",
    BracketLeft: "[", BracketRight: "]",
    Comma: ",", Period: ".", Slash: "/",
    Semicolon: ";", Quote: "'",
    Minus: "-", Equal: "=",
    Space: "Space", Tab: "Tab", Enter: "Enter",
    Backspace: "⌫", Delete: "Del", Escape: "Esc",
    Home: "Home", End: "End",
    PageUp: "PgUp", PageDown: "PgDn",
    Insert: "Ins", CapsLock: "Caps",
  }

  return labels[code] ?? code
}

export function exportComboToString(current: CurrentCombo): string {
  return JSON.stringify({ version: 3, potions: current.potions, skills: current.skills }, null, 2)
}

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
