import { useCallback, useEffect, useRef, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { toast } from "sonner"
import type { AutoStopConfig } from "@/shared/types"
import type {
  PotionsRunConfig,
  RunnerInputs,
  SkillsRunConfig,
} from "@/runner/runner-inputs"

type UseMacroRunnerArgs = {
  potionsCanRun: boolean
  potionsConfig: PotionsRunConfig
  skillsCanRun: boolean
  skillsConfig: SkillsRunConfig
  /** Auto-stop-on-focus-loss config, forwarded verbatim to the backend. */
  autoStop: AutoStopConfig
  onStart?: () => void
  onStop?: () => void
}

type RunnerStatus = {
  sessionId: number
  potionsRunning: boolean
  skillsRunning: boolean
}

export type RunStopReason =
  | "manual"
  | "emergency"
  | "repeat-complete"
  | "focus-lost"
  | "profile-switch"
  | "startup-failure"

/**
 * Drives the backend runner: start/stop/toggle combos via Tauri commands and
 * mirrors running state from the `macro-activation` / `macro-finished` events.
 * `startCombo` swaps channels atomically on the backend, so it is safe to call
 * immediately after loading a combo file without waiting for a re-render.
 */
export function useMacroRunner({
  potionsCanRun,
  potionsConfig,
  skillsCanRun,
  skillsConfig,
  autoStop,
  onStart,
  onStop,
}: UseMacroRunnerArgs) {
  const [potionsRunning, setPotionsRunning] = useState(false)
  const [skillsRunning, setSkillsRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [potionsCycles, setPotionsCycles] = useState(0)
  const [skillsCycles, setSkillsCycles] = useState(0)
  const [sessionId, setSessionId] = useState(0)
  const [commandPending, setCommandPending] = useState(false)
  const [skillStepEvent, setSkillStepEvent] = useState<{ sessionId: number; stepIndex: number } | null>(null)
  const [lastStopReason, setLastStopReason] = useState<RunStopReason | null>(null)

  const anyRunning = potionsRunning || skillsRunning

  const potionsRunningRef = useRef(potionsRunning)
  potionsRunningRef.current = potionsRunning
  const skillsRunningRef = useRef(skillsRunning)
  skillsRunningRef.current = skillsRunning

  const potionsCanRunRef = useRef(potionsCanRun)
  potionsCanRunRef.current = potionsCanRun
  const skillsCanRunRef = useRef(skillsCanRun)
  skillsCanRunRef.current = skillsCanRun

  const potionsConfigRef = useRef(potionsConfig)
  potionsConfigRef.current = potionsConfig
  const skillsConfigRef = useRef(skillsConfig)
  skillsConfigRef.current = skillsConfig

  const autoStopRef = useRef(autoStop)
  autoStopRef.current = autoStop

  const onStartRef = useRef(onStart)
  onStartRef.current = onStart
  const onStopRef = useRef(onStop)
  onStopRef.current = onStop

  // Tauri commands may execute concurrently. Serializing them here preserves
  // user intent for rapid start/stop/switch requests.
  const commandQueueRef = useRef<Promise<void>>(Promise.resolve())
  const requestSeqRef = useRef(0)
  const enqueue = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    const result = commandQueueRef.current.then(operation, operation)
    commandQueueRef.current = result.then(() => undefined, () => undefined)
    return result
  }, [])

  // Starts an explicit combo atomically (stop both + start the enabled channels
  // in a single backend command). Does not depend on React state having
  // re-rendered, so it is safe to call right after loading a combo file.
  const startCombo = useCallback(async (inputs: RunnerInputs) => {
    const replacesActiveRun = potionsRunningRef.current || skillsRunningRef.current
    const potions = inputs.potionsCanRun ? inputs.potionsConfig : null
    const skills = inputs.skillsCanRun ? inputs.skillsConfig : null

    if (!potions && !skills) {
      toast.warning("Enable at least one channel first")
      return false
    }

    const request = ++requestSeqRef.current
    setCommandPending(true)
    try {
      const status = await enqueue(() => invoke<RunnerStatus>("start_combo", {
        potions,
        skills,
        autoStop: autoStopRef.current,
      }))
      if (request !== requestSeqRef.current) return false
      setSessionId(status.sessionId)
      setSkillStepEvent(null)
      setPotionsRunning(status.potionsRunning)
      setSkillsRunning(status.skillsRunning)
      if (replacesActiveRun) setLastStopReason("profile-switch")
      if (status.potionsRunning || status.skillsRunning) onStartRef.current?.()
      return status.potionsRunning || status.skillsRunning
    } catch (e) {
      if (request !== requestSeqRef.current) return false
      setSessionId(0)
      setPotionsRunning(false)
      setSkillsRunning(false)
      onStopRef.current?.()
      setLastStopReason("startup-failure")
      toast.error(`Failed to start macro: ${e}`)
      return false
    } finally {
      if (request === requestSeqRef.current) setCommandPending(false)
    }
  }, [enqueue])

  const stopAll = useCallback(async (reason: RunStopReason = "manual") => {
    const request = ++requestSeqRef.current
    setCommandPending(true)
    try {
      const status = await enqueue(() => invoke<RunnerStatus>("stop_all"))
      if (request !== requestSeqRef.current) return false
      setSessionId(status.sessionId)
      setSkillStepEvent(null)
      setPotionsRunning(status.potionsRunning)
      setSkillsRunning(status.skillsRunning)
      setLastStopReason(reason)
      onStopRef.current?.()
      return true
    } catch (e) {
      if (request !== requestSeqRef.current) return false
      toast.error(`Failed to stop macro: ${e}`)
      return false
    } finally {
      if (request === requestSeqRef.current) setCommandPending(false)
    }
  }, [enqueue])

  // Toggle for the current UI combo (used by the on-screen STOP and by hotkeys
  // that have no combo file attached). The live config refs already reflect the
  // tabs, so there is no load race here.
  const toggleRunning = useCallback(() => {
    if (potionsRunningRef.current || skillsRunningRef.current) {
      stopAll()
      return
    }
    startCombo({
      potionsConfig: potionsConfigRef.current,
      potionsCanRun: potionsCanRunRef.current,
      skillsConfig: skillsConfigRef.current,
      skillsCanRun: skillsCanRunRef.current,
    })
  }, [startCombo, stopAll])

  useEffect(() => {
    if (!anyRunning) return
    setElapsed(0)
    setPotionsCycles(0)
    setSkillsCycles(0)
    const secondTick = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(secondTick)
  }, [anyRunning])

  useEffect(() => {
    const unlistenActivation = listen<{ channel: string; cycle: number }>(
      "macro-activation",
      (event) => {
        if (event.payload.channel === "potions") {
          setPotionsCycles(event.payload.cycle)
        } else if (event.payload.channel === "skills") {
          setSkillsCycles(event.payload.cycle)
        }
      },
    )

    const unlistenStep = listen<{ sessionId: number; stepIndex: number }>(
      "macro-step",
      (event) => setSkillStepEvent(event.payload),
    )

    const unlistenFinished = listen<{ channel: string; reason?: "repeat-complete" }>(
      "macro-finished",
      (event) => {
        if (event.payload.channel === "potions") {
          setPotionsRunning(false)
        } else if (event.payload.channel === "skills") {
          setSkillsRunning(false)
        }
        setLastStopReason(event.payload.reason ?? "repeat-complete")

        if (
          (event.payload.channel === "potions" && !skillsRunningRef.current) ||
          (event.payload.channel === "skills" && !potionsRunningRef.current)
        ) {
          onStopRef.current?.()
        }
      },
    )

    const unlistenAutoStopped = listen<{ reason: string }>(
      "macro-auto-stopped",
      () => {
        // Backend already stopped both channels — just mirror the state and
        // run the same teardown as a manual stop (exit compact, clear profile).
        setPotionsRunning(false)
        setSkillsRunning(false)
        setLastStopReason("focus-lost")
        onStopRef.current?.()
        toast.info("Stopped: game window lost focus")
      },
    )

    return () => {
      unlistenActivation.then((fn) => fn())
      unlistenStep.then((fn) => fn())
      unlistenFinished.then((fn) => fn())
      unlistenAutoStopped.then((fn) => fn())
    }
  }, [])

  useEffect(() => {
    invoke<RunnerStatus>("get_runner_status")
      .then((status) => {
        if (!status) return
        setSessionId(status.sessionId)
        setPotionsRunning(status.potionsRunning)
        setSkillsRunning(status.skillsRunning)
      })
      .catch(() => {})
  }, [])

  return {
    potionsRunning,
    skillsRunning,
    sessionId,
    commandPending,
    anyRunning,
    elapsed,
    potionsCycles,
    skillsCycles,
    activeSkillStepIndex: skillsRunning && skillStepEvent?.sessionId === sessionId
      ? skillStepEvent.stepIndex
      : null,
    lastStopReason,
    totalCycles: potionsCycles + skillsCycles,
    toggleRunning,
    startCombo,
    stopAll,
  }
}
