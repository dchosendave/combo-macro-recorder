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

  // Bumped by every cache invalidation (`clearCachedCombo`). A read that
  // started before a save must not write its pre-save snapshot into the cache
  // afterwards — that would resurrect the old file's settings (e.g. a disabled
  // "hold right click" coming back on) on the next press.
  const cacheGenRef = useRef(0)

  // Reads a combo file into the cache. If a save (cache invalidation) landed
  // while the first read was in flight, re-reads once so the cached snapshot is
  // never older than the last save.
  const readComboFresh = async (path: string): Promise<CurrentCombo> => {
    const gen = cacheGenRef.current
    let content = await invoke<string>("read_file", { path })
    if (gen !== cacheGenRef.current) {
      content = await invoke<string>("read_file", { path })
    }
    const combo = importComboFromString(content)
    comboCacheRef.current.set(path, combo)
    return combo
  }

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
          await readComboFresh(path)
        } catch {
          // Ignore preload failures; the on-demand path will surface errors.
        }
        if (cancelled) return
      }
    })()
    return () => {
      cancelled = true
    }
  }, [comboPathsKey])  // eslint-disable-line react-hooks/exhaustive-deps

  const clearCachedCombo = (path: string) => {
    comboCacheRef.current.delete(path)
    // Invalidate any read still in flight so it can't repopulate stale data.
    cacheGenRef.current += 1
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
          combo = await readComboFresh(profile.comboPath)
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
