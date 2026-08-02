import type { MutableRefObject } from "react"
import { useEffect, useMemo, useRef } from "react"
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

/**
 * Wires OS-level global hotkeys to combo execution.
 *
 * Flow: registers shortcuts (debounced) via `set_hotkeys`; the Rust global-shortcut
 * handler emits a `macro-toggle` event with the profile id, which is handled here.
 * Combos are preloaded into a cache so presses are instant; a monotonic token makes
 * the last press win if a file load is still in flight. A press on the profile that
 * is already running stops it instead.
 */
export function useGlobalHotkeys({
  hotkeys,
  toggleRunning,
  startCombo,
  stopAll,
  applyCombo,
  runningProfileIdRef,
}: UseGlobalHotkeysArgs) {
  const hotkeysRef = useRef(hotkeys)
  hotkeysRef.current = hotkeys

  const toggleRunningRef = useRef(toggleRunning)
  toggleRunningRef.current = toggleRunning

  const startComboRef = useRef(startCombo)
  startComboRef.current = startCombo

  const stopAllRef = useRef(stopAll)
  stopAllRef.current = stopAll

  const applyComboRef = useRef(applyCombo)
  applyComboRef.current = applyCombo

  // Register the OS-level global shortcuts (debounced to avoid thrash).
  useEffect(() => {
    const timer = setTimeout(() => {
      const mapped = hotkeysRef.current
        .filter((p) => p.hotkey)
        .map((p) => ({
          shortcut: codeToShortcut(p.hotkey),
          hotkeyId: p.id,
        }))
      invoke("set_hotkeys", { hotkeys: mapped }).catch(
        () => toast.warning("Failed to register global hotkeys"),
      )
    }, 50)
    return () => clearTimeout(timer)
  }, [hotkeys])

  // Parsed-combo cache so switching is instant and deterministic (no per-press
  // disk read/parse latency).
  const comboCacheRef = useRef<Map<string, CurrentCombo>>(new Map())

  // Monotonic token; every combo-file press bumps it so any in-flight load from
  // an older press self-cancels → "last press wins".
  const seqRef = useRef(0)

  // Preload every attached combo file once (and whenever the set of paths
  // changes), populating the cache.
  const comboPathsKey = useMemo(
    () =>
      hotkeys
        .map((p) => p.comboPath)
        .filter(Boolean)
        .sort()
        .join("|"),
    [hotkeys],
  )

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
      const profile = hotkeysRef.current.find((p) => p.id === event.payload)
      if (!profile) return

      // No combo file attached → toggle the current UI combo.
      if (!profile.comboPath) {
        toggleRunningRef.current()
        return
      }

      // Any combo-file press invalidates older in-flight loads.
      const token = ++seqRef.current

      // Pressing the profile that's already running → stop.
      if (runningProfileIdRef.current === profile.id) {
        stopAllRef.current()
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

        applyComboRef.current(combo) // reflect the loaded combo in the tabs
        runningProfileIdRef.current = profile.id
        startComboRef.current(toRunnerInputs(combo)) // atomic backend switch
      } catch {
        if (token === seqRef.current) {
          toast.error(`Failed to load ${profile.name}`)
        }
      }
    })
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [])

  return { clearCachedCombo }
}
