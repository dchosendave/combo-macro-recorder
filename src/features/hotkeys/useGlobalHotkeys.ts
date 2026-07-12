import type { MutableRefObject } from "react"
import { useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { toast } from "sonner"
import { codeToShortcut } from "@/shared/lib/keycodes"
import { importComboFromString } from "@/features/combo-file/lib/combo-io"
import type { CurrentCombo, HotkeyBinding } from "@/shared/lib/types"

type UseGlobalHotkeysArgs = {
  hotkeys: HotkeyBinding[]
  toggleRunning: () => void
  applyCombo: (combo: CurrentCombo) => void
  runningProfileIdRef: MutableRefObject<string | null>
}

export function useGlobalHotkeys({
  hotkeys,
  toggleRunning,
  applyCombo,
  runningProfileIdRef,
}: UseGlobalHotkeysArgs) {
  useEffect(() => {
    const mapped = hotkeys
      .filter((p) => p.hotkey)
      .map((p) => ({
        shortcut: codeToShortcut(p.hotkey),
        hotkeyId: p.id,
      }))
    invoke("set_hotkeys", { hotkeys: mapped }).catch(
      () => toast.warning("Failed to register global hotkeys"),
    )
  }, [hotkeys])

  useEffect(() => {
    const unlisten = listen<string>("macro-toggle", (event) => {
      const hotkeyId = event.payload
      const profile = hotkeys.find((p) => p.id === hotkeyId)
      if (!profile) return

      if (profile.comboPath) {
        // Same profile pressed again → just toggle (stop)
        if (runningProfileIdRef.current === profile.id) {
          toggleRunning()
          return
        }

        // Different profile or nothing running → stop current, load file, start
        invoke("stop_all")
        runningProfileIdRef.current = null
        invoke<string>("read_file", { path: profile.comboPath })
          .then((content) => {
            const combo = importComboFromString(content)
            applyCombo(combo)
            runningProfileIdRef.current = profile.id
            setTimeout(() => toggleRunning(), 0)
          })
          .catch(() => toast.error(`Failed to load ${profile.name}`))
      } else {
        toggleRunning()
      }
    })
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [toggleRunning, hotkeys, applyCombo, runningProfileIdRef])
}
