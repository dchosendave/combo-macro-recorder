import type { MutableRefObject } from "react"
import { useEffect, useRef } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { toast } from "sonner"
import { codeToShortcut } from "@/shared/keycodes"
import { importComboFromString } from "@/combo-file/combo-io"
import { toRunnerInputs, type RunnerInputs } from "@/runner/runner-inputs"
import type { CurrentCombo, HotkeyBinding } from "@/shared/types"

type UseGlobalHotkeysArgs = {
  hotkeys: HotkeyBinding[]
  toggleRunning: () => void
  startCombo: (inputs: RunnerInputs) => void
  stopAll: () => void
  applyCombo: (combo: CurrentCombo) => void
  runningProfileIdRef: MutableRefObject<string | null>
}

export function useGlobalHotkeys({
  hotkeys,
  toggleRunning,
  startCombo,
  stopAll,
  applyCombo,
  runningProfileIdRef,
}: UseGlobalHotkeysArgs) {
  // Register the OS-level global shortcuts.
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

  // Parsed-combo cache so switching is instant and deterministic (no per-press
  // disk read/parse latency).
  const comboCacheRef = useRef<Map<string, CurrentCombo>>(new Map())

  // Monotonic token; every combo-file press bumps it so any in-flight load from
  // an older press self-cancels → "last press wins".
  const seqRef = useRef(0)

  // Preload every attached combo file once (and whenever the set of paths
  // changes), populating the cache.
  const comboPathsKey = hotkeys
    .map((p) => p.comboPath)
    .filter(Boolean)
    .sort()
    .join("|")

  useEffect(() => {
    let cancelled = false
    const paths = comboPathsKey ? comboPathsKey.split("|") : []
    ;(async () => {
      for (const path of paths) {
        if (comboCacheRef.current.has(path)) continue
        try {
          const content = await invoke<string>("read_file", { path })
          if (cancelled) return
          comboCacheRef.current.set(path, importComboFromString(content))
        } catch {
          // Ignore preload failures; the on-demand path will surface errors.
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [comboPathsKey])

  const clearCachedCombo = (path: string) => {
    comboCacheRef.current.delete(path)
  }

  useEffect(() => {
    const unlisten = listen<string>("macro-toggle", async (event) => {
      const profile = hotkeys.find((p) => p.id === event.payload)
      if (!profile) return

      // No combo file attached → toggle the current UI combo.
      if (!profile.comboPath) {
        toggleRunning()
        return
      }

      // Any combo-file press invalidates older in-flight loads.
      const token = ++seqRef.current

      // Pressing the profile that's already running → stop.
      if (runningProfileIdRef.current === profile.id) {
        stopAll()
        runningProfileIdRef.current = null
        return
      }

      // Switch: load (cached) combo, then start it with its own config.
      try {
        let combo = comboCacheRef.current.get(profile.comboPath)
        if (!combo) {
          const content = await invoke<string>("read_file", { path: profile.comboPath })
          combo = importComboFromString(content)
          comboCacheRef.current.set(profile.comboPath, combo)
        }
        // A newer press superseded this one while we were loading.
        if (token !== seqRef.current) return

        applyCombo(combo) // reflect the loaded combo in the tabs
        runningProfileIdRef.current = profile.id
        startCombo(toRunnerInputs(combo)) // atomic backend switch
      } catch {
        if (token === seqRef.current) {
          toast.error(`Failed to load ${profile.name}`)
        }
      }
    })
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [hotkeys, toggleRunning, startCombo, stopAll, applyCombo, runningProfileIdRef])

  return { clearCachedCombo }
}
