import { defaultHotkeyBinding } from "./defaults"
import type { HotkeyBinding } from "./types"

export const STORAGE_KEY = "combo-macro-settings"

export function loadHotkeys(): HotkeyBinding[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [defaultHotkeyBinding()]
    const parsed = JSON.parse(raw)

    if (parsed?.version === 3) {
      if (Array.isArray(parsed.hotkeys) && parsed.hotkeys.length > 0) {
        return parsed.hotkeys.map((binding: HotkeyBinding) => ({ ...binding, mode: binding.mode ?? "toggle" }))
      }
      return [defaultHotkeyBinding()]
    }

    // V2
    if (parsed?.version === 2) {
      return [
        {
          id: crypto.randomUUID(),
          name: "Untitled",
          hotkey: parsed.hotkey ?? "F5",
          comboPath: "",
          mode: "toggle",
          comboPaths: [],
        },
      ]
    }

    // V1
    return [{ ...defaultHotkeyBinding(), hotkey: parsed.hotkey ?? "F5" }]
  } catch {
    return [defaultHotkeyBinding()]
  }
}

export function saveHotkeys(hotkeys: HotkeyBinding[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 3, hotkeys }))
}

export function clearHotkeys() {
  localStorage.removeItem(STORAGE_KEY)
}

export const RECENT_FILES_KEY = "combo-macro-recent-files"
export const MAX_RECENT_FILES = 8

export function loadRecentFiles(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_FILES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((p) => typeof p === "string" && p.length > 0)
  } catch {
    return []
  }
}

export function saveRecentFiles(paths: string[]) {
  localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(paths))
}

export function addRecentPath(paths: string[], path: string): string[] {
  return [path, ...paths.filter((p) => p !== path)].slice(0, MAX_RECENT_FILES)
}

export function clearRecentFiles() {
  localStorage.removeItem(RECENT_FILES_KEY)
}

export const TUTORIAL_SEEN_KEY = "combo-macro-tutorial-seen"

/** Whether the first-run tutorial has been dismissed at least once. Absent or corrupt values count as not seen. */
export function loadTutorialSeen(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_SEEN_KEY) === "1"
  } catch {
    return false
  }
}

export function saveTutorialSeen() {
  localStorage.setItem(TUTORIAL_SEEN_KEY, "1")
}
