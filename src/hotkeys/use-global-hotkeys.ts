import type { MutableRefObject } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { toast } from "sonner"
import { codeToShortcut } from "@/shared/keycodes"
import { importComboFromString } from "@/combo-file/combo-io"
import { toRunnerInputs, type RunnerInputs } from "@/runner/runner-inputs"
import type { CurrentCombo, HotkeyBinding } from "@/shared/types"

type UseGlobalHotkeysArgs = {
  hotkeys: HotkeyBinding[]
  emergencyHotkey: string
  onEmergencyStop: () => void
  toggleRunning: () => void
  startCurrentCombo: () => Promise<boolean> | void
  startCombo: (inputs: RunnerInputs) => Promise<boolean> | void
  stopAll: () => Promise<boolean> | void
  applyCombo: (combo: CurrentCombo) => void
  runningProfileIdRef: MutableRefObject<string | null>
}

export type HotkeyRegistrationStatus = "idle" | "pending" | "ready" | "error"

/**
 * Wires OS-level global hotkeys to combo execution.
 *
 * Flow: registers shortcuts (debounced) via `set_hotkeys`; the Rust global-shortcut
 * handler emits a `macro-hotkey` event with the profile id and press/release state.
 * Combos are preloaded into a cache so presses are instant; a monotonic token makes
 * the last press win if a file load is still in flight. A press on the profile that
 * is already running stops it instead.
 */
export function useGlobalHotkeys({
  hotkeys,
  emergencyHotkey,
  onEmergencyStop,
  toggleRunning,
  startCurrentCombo,
  startCombo,
  stopAll,
  applyCombo,
  runningProfileIdRef,
}: UseGlobalHotkeysArgs) {
  const [registrationStatus, setRegistrationStatus] = useState<HotkeyRegistrationStatus>("idle")
  const [registrationError, setRegistrationError] = useState<string | null>(null)
  const [unavailablePaths, setUnavailablePaths] = useState<string[]>([])
  const hotkeysRef = useRef(hotkeys)
  hotkeysRef.current = hotkeys
  const emergencyHotkeyRef = useRef(emergencyHotkey)
  emergencyHotkeyRef.current = emergencyHotkey
  const onEmergencyStopRef = useRef(onEmergencyStop)
  onEmergencyStopRef.current = onEmergencyStop

  const toggleRunningRef = useRef(toggleRunning)
  toggleRunningRef.current = toggleRunning

  const startComboRef = useRef(startCombo)
  startComboRef.current = startCombo
  const startCurrentComboRef = useRef(startCurrentCombo)
  startCurrentComboRef.current = startCurrentCombo

  const stopAllRef = useRef(stopAll)
  stopAllRef.current = stopAll

  const applyComboRef = useRef(applyCombo)
  applyComboRef.current = applyCombo

  // Register the OS-level global shortcuts (debounced to avoid thrash).
  useEffect(() => {
    setRegistrationStatus("pending")
    setRegistrationError(null)
    const timer = setTimeout(() => {
      const mapped = hotkeysRef.current
        .filter((p) => p.hotkey)
        .map((p) => ({
          shortcut: codeToShortcut(p.hotkey),
          hotkeyId: p.id,
        }))
      if (emergencyHotkeyRef.current) {
        mapped.push({
          shortcut: codeToShortcut(emergencyHotkeyRef.current),
          hotkeyId: "__emergency_stop__",
        })
      }
      invoke("set_hotkeys", { hotkeys: mapped })
        .then(() => setRegistrationStatus("ready"))
        .catch((error) => {
          const message = String(error)
          setRegistrationStatus("error")
          setRegistrationError(message)
          toast.warning("Failed to register global hotkeys")
        })
    }, 50)
    return () => clearTimeout(timer)
  }, [hotkeys, emergencyHotkey])

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
        .flatMap((p) => [p.comboPath, ...(p.comboPaths ?? [])])
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
          if (!cancelled) setUnavailablePaths((current) => current.filter((item) => item !== path))
        } catch {
          // Ignore preload failures; the on-demand path will surface errors.
          if (!cancelled) setUnavailablePaths((current) => current.includes(path) ? current : [...current, path])
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

  const cycleIndexRef = useRef<Map<string, number>>(new Map())
  const cycleListsKey = useMemo(
    () => hotkeys.map((profile) => `${profile.id}:${(profile.comboPaths ?? []).join(",")}`).join("|"),
    [hotkeys],
  )
  useEffect(() => {
    cycleIndexRef.current.clear()
  }, [cycleListsKey])

  useEffect(() => {
    const unlisten = listen<{ hotkeyId: string; state: "pressed" | "released" }>("macro-hotkey", async (event) => {
      const { hotkeyId, state } = event.payload
      if (hotkeyId === "__emergency_stop__") {
        if (state !== "pressed") return
        seqRef.current += 1
        runningProfileIdRef.current = null
        onEmergencyStopRef.current()
        return
      }
      const profile = hotkeysRef.current.find((p) => p.id === hotkeyId)
      if (!profile) return
      const mode = profile.mode ?? "toggle"

      if (state === "released") {
        if (mode === "hold" && runningProfileIdRef.current === profile.id) {
          await stopAllRef.current()
          runningProfileIdRef.current = null
        }
        return
      }

      if (mode === "stop") {
        seqRef.current += 1
        await stopAllRef.current()
        runningProfileIdRef.current = null
        return
      }

      if ((mode === "start" || mode === "hold") && runningProfileIdRef.current === profile.id) return

      if (mode === "cycle") {
        const paths = profile.comboPaths ?? []
        if (paths.length === 0) {
          toast.warning(`${profile.name} has no combos to cycle`)
          return
        }
        const token = ++seqRef.current
        const startIndex = cycleIndexRef.current.get(profile.id) ?? 0
        for (let offset = 0; offset < paths.length; offset += 1) {
          const index = (startIndex + offset) % paths.length
          const path = paths[index]
          try {
            let combo = comboCacheRef.current.get(path)
            if (!combo) combo = await readComboFresh(path)
            if (token !== seqRef.current) return
            applyComboRef.current(combo)
            const started = await startComboRef.current(toRunnerInputs(combo))
            if (started === false) return
            cycleIndexRef.current.set(profile.id, (index + 1) % paths.length)
            runningProfileIdRef.current = profile.id
            if (offset > 0) toast.warning(`Skipped ${offset} unavailable combo${offset === 1 ? "" : "s"}`)
            return
          } catch {
            // Continue to the next configured combo.
          }
        }
        if (token === seqRef.current) toast.error(`No available combos for ${profile.name}`)
        return
      }

      // No combo file attached → toggle the current UI combo.
      if (!profile.comboPath) {
        if (mode === "toggle") {
          toggleRunningRef.current()
        } else {
          const started = await startCurrentComboRef.current()
          if (started !== false) runningProfileIdRef.current = profile.id
        }
        return
      }

      // Any combo-file press invalidates older in-flight loads.
      const token = ++seqRef.current

      // Pressing the profile that's already running → stop.
      if (mode === "toggle" && runningProfileIdRef.current === profile.id) {
        await stopAllRef.current()
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
        const started = await startComboRef.current(toRunnerInputs(combo)) // atomic backend switch
        if (started !== false) runningProfileIdRef.current = profile.id
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

  return { clearCachedCombo, registrationStatus, registrationError, unavailablePaths }
}
