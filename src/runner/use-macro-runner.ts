import { useCallback, useEffect, useRef, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { toast } from "sonner"
import type { AutoStopConfig } from "@/shared/types"
import type { PotionsRunConfig, RunnerInputs, SkillsRunConfig } from "@/runner/runner-inputs"

type UseMacroRunnerArgs = {
  potionsCanRun: boolean
  potionsConfig: PotionsRunConfig
  skillsCanRun: boolean
  skillsConfig: SkillsRunConfig
  autoStop: AutoStopConfig
  onStart?: () => void
  onStop?: () => void
}
type RunnerStatus = { sessionId: number; potionsRunning: boolean; skillsRunning: boolean }
type Channel = "potions" | "skills"
type Completion = { sessionId: number; channel: Channel; cycle: number; reason: "repeat-complete" | "injection-failure"; error?: string }
export type RunStopReason = "manual" | "emergency" | "repeat-complete" | "focus-lost" | "profile-switch" | "startup-failure" | "injection-failure"

export function useMacroRunner(args: UseMacroRunnerArgs) {
  const argsRef = useRef(args)
  argsRef.current = args
  const [status, setStatus] = useState<RunnerStatus>({ sessionId: 0, potionsRunning: false, skillsRunning: false })
  const statusRef = useRef(status)
  const [elapsed, setElapsed] = useState(0)
  const [potionsCycles, setPotionsCycles] = useState(0)
  const [skillsCycles, setSkillsCycles] = useState(0)
  const [commandPending, setCommandPending] = useState(false)
  const [skillStepEvent, setSkillStepEvent] = useState<{ sessionId: number; stepIndex: number } | null>(null)
  const [lastStopReason, setLastStopReason] = useState<RunStopReason | null>(null)
  const requestSeq = useRef(0)
  const pendingStart = useRef(false)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const listenersReady = useRef<Promise<void>>(Promise.resolve())
  // Completion may arrive before its start command response. Keep the newest
  // session's terminal facts so a late response cannot resurrect a finished run.
  const terminal = useRef<{ sessionId: number; potions?: Completion; skills?: Completion; focusLost?: boolean }>({ sessionId: 0 })
  const enqueue = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.current.then(operation, operation)
    queue.current = result.catch(() => {})
    return result
  }, [])

  const applyStatus = useCallback((incoming: RunnerStatus) => {
    const previous = statusRef.current
    const next = { ...incoming }
    const ended = terminal.current
    if (next.sessionId !== previous.sessionId && next.sessionId !== 0) {
      setElapsed(0)
      setPotionsCycles(0)
      setSkillsCycles(0)
      setSkillStepEvent(null)
    }
    if (ended.sessionId === next.sessionId) {
      if (ended.potions) { next.potionsRunning = false; setPotionsCycles(ended.potions.cycle) }
      if (ended.skills) { next.skillsRunning = false; setSkillsCycles(ended.skills.cycle) }
      if (ended.focusLost) next.potionsRunning = next.skillsRunning = false
      const reason = ended.focusLost ? "focus-lost" : ended.skills?.reason ?? ended.potions?.reason
      if (reason) setLastStopReason(reason)
    }
    statusRef.current = next
    setStatus(next)
    const running = next.potionsRunning || next.skillsRunning
    if (running && (next.sessionId !== previous.sessionId || !(previous.potionsRunning || previous.skillsRunning))) argsRef.current.onStart?.()
    if (!running && (previous.potionsRunning || previous.skillsRunning)) argsRef.current.onStop?.()
    return running
  }, [])

  const startCombo = useCallback(async (inputs: RunnerInputs) => {
    const potions = inputs.potionsCanRun ? inputs.potionsConfig : null
    const skills = inputs.skillsCanRun ? inputs.skillsConfig : null
    if (!potions && !skills) { toast.warning("Enable at least one channel first"); return false }
    const request = ++requestSeq.current
    pendingStart.current = true
    setCommandPending(true)
    const replacesActiveRun = statusRef.current.potionsRunning || statusRef.current.skillsRunning
    try {
      const next = await enqueue(async () => {
        await listenersReady.current
        return invoke<RunnerStatus>("start_combo", { potions, skills, autoStop: argsRef.current.autoStop })
      })
      if (request !== requestSeq.current) return false
      if (replacesActiveRun) setLastStopReason("profile-switch")
      return applyStatus(next)
    } catch (error) {
      if (request !== requestSeq.current) return false
      // Rejection can happen before Rust touches the existing run.
      try {
        const current = await enqueue(() => invoke<RunnerStatus>("get_runner_status"))
        if (request === requestSeq.current && current) applyStatus(current)
      } catch { /* Keep the last confirmed state when reconciliation also fails. */ }
      if (request === requestSeq.current) {
        setLastStopReason("startup-failure")
        toast.error(`Failed to start macro: ${error}`)
      }
      return false
    } finally {
      if (request === requestSeq.current) { pendingStart.current = false; setCommandPending(false) }
    }
  }, [enqueue, applyStatus])

  const stopAll = useCallback(async (reason: RunStopReason = "manual") => {
    window.dispatchEvent(new Event("macro-stop-requested"))
    const request = ++requestSeq.current
    pendingStart.current = false
    setCommandPending(true)
    try {
      const next = await enqueue(() => invoke<RunnerStatus>("stop_all"))
      if (request !== requestSeq.current) return false
      const wasRunning = statusRef.current.potionsRunning || statusRef.current.skillsRunning
      applyStatus(next)
      setSkillStepEvent(null)
      setLastStopReason(reason)
      // Also cancels an in-flight compact entry after a very short run.
      if (!wasRunning) argsRef.current.onStop?.()
      return !(next.potionsRunning || next.skillsRunning)
    } catch (error) {
      if (request === requestSeq.current) toast.error(`Failed to stop macro: ${error}`)
      return false
    } finally {
      if (request === requestSeq.current) setCommandPending(false)
    }
  }, [enqueue, applyStatus])

  const toggleRunning = useCallback(() => {
    if (pendingStart.current || statusRef.current.potionsRunning || statusRef.current.skillsRunning) void stopAll()
    else void startCombo(argsRef.current)
  }, [startCombo, stopAll])
  const anyRunning = status.potionsRunning || status.skillsRunning

  useEffect(() => {
    if (!anyRunning) return
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => clearInterval(timer)
  }, [anyRunning, status.sessionId])

  useEffect(() => {
    let disposed = false
    const rememberSession = (sessionId: number) => {
      if (sessionId < terminal.current.sessionId) return false
      if (sessionId > terminal.current.sessionId) terminal.current = { sessionId }
      return true
    }
    const subscriptions = [
      listen<{ sessionId: number; channel: Channel; cycle: number }>("macro-activation", ({ payload }) => {
        if (payload.sessionId !== statusRef.current.sessionId) return
        if (payload.channel === "potions" && statusRef.current.potionsRunning) setPotionsCycles(payload.cycle)
        if (payload.channel === "skills" && statusRef.current.skillsRunning) setSkillsCycles(payload.cycle)
      }),
      listen<{ sessionId: number; stepIndex: number }>("macro-step", ({ payload }) => setSkillStepEvent(payload)),
      listen<Completion>("macro-finished", ({ payload }) => {
        if (!rememberSession(payload.sessionId)) return
        terminal.current[payload.channel] = payload
        if (payload.sessionId === statusRef.current.sessionId) applyStatus(statusRef.current)
        if (payload.reason === "injection-failure") toast.error(payload.error ?? "Input injection failed")
      }),
      listen<{ sessionId: number; reason: string }>("macro-auto-stopped", ({ payload }) => {
        if (!rememberSession(payload.sessionId)) return
        terminal.current.focusLost = true
        if (payload.sessionId === statusRef.current.sessionId) {
          applyStatus(statusRef.current)
          toast.info("Stopped: game window lost focus")
        }
      }),
    ]
    const request = requestSeq.current
    // Subscribe before reconciliation so short runs cannot finish in the gap.
    listenersReady.current = Promise.all(subscriptions).then(() => {})
    void invoke<RunnerStatus>("get_runner_status").then(async (current) => {
      await listenersReady.current
      if (!disposed && request === requestSeq.current && current) applyStatus(current)
    }).catch((error) => toast.error(`Runner synchronization failed: ${error}`))
    return () => {
      disposed = true
      for (const subscription of subscriptions) void subscription.then((unlisten) => unlisten())
    }
  }, [applyStatus])

  return {
    ...status, commandPending, anyRunning, elapsed, potionsCycles, skillsCycles,
    activeSkillStepIndex: status.skillsRunning && skillStepEvent?.sessionId === status.sessionId ? skillStepEvent.stepIndex : null,
    lastStopReason, toggleRunning, startCombo, stopAll,
  }
}
