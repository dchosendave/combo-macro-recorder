export const MIN_DELAY = 2
export const MIN_REPEAT = 1
export const STORAGE_KEY = "combo-macro-settings"

export type PotionKey = "q" | "w" | "e" | "r"
export type RepeatMode = "loop" | "count"

export type Settings = {
  autoPotions: boolean
  keys: Record<PotionKey, boolean>
  customDelay: boolean
  delayMs: string
  hotkey: string
  repeatMode: RepeatMode
  repeatCount: string
}

export const DEFAULTS: Settings = {
  autoPotions: false,
  keys: { q: true, w: true, e: true, r: true },
  customDelay: false,
  delayMs: String(MIN_DELAY),
  hotkey: "F5",
  repeatMode: "loop",
  repeatCount: "1",
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULTS,
      ...parsed,
      keys: { ...DEFAULTS.keys, ...(parsed?.keys ?? {}) },
    }
  } catch {
    return DEFAULTS
  }
}

export function saveSettings(settings: Settings) {
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

// Convert a DOM KeyboardEvent.key into a Tauri global-shortcut accelerator.
export function toAccelerator(key: string): string {
  if (/^F\d{1,2}$/.test(key)) return key
  if (key.length === 1) {
    if (/[a-zA-Z]/.test(key)) return key.toUpperCase()
    if (/[0-9]/.test(key)) return key
  }
  return SPECIAL_ACCELERATORS[key] ?? key
}

