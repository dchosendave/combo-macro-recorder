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
        return parsed.hotkeys as HotkeyBinding[]
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
