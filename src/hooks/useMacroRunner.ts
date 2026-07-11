import { useCallback, useEffect, useRef, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { toast } from "sonner"
import { MIN_DELAY, MIN_REPEAT, type PotionKey, type RepeatMode } from "@/lib/settings"

type UseMacroRunnerArgs = {
  canRun: boolean
  keys: Record<PotionKey, boolean>
  delayMs: string
  delayError: boolean
  repeatMode: RepeatMode
  repeatCount: string
}

export function useMacroRunner({
  canRun,
  keys,
  delayMs,
  delayError,
  repeatMode,
  repeatCount,
}: UseMacroRunnerArgs) {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [activations, setActivations] = useState(0)

  const configRef = useRef({ keys, delayMs, delayError, repeatMode, repeatCount })
  configRef.current = { keys, delayMs, delayError, repeatMode, repeatCount }

  const runningRef = useRef(running)
  runningRef.current = running

  const canRunRef = useRef(canRun)
  canRunRef.current = canRun

  const toggleRunning = useCallback(() => {
    if (runningRef.current) {
      invoke("stop_macro")
      setRunning(false)
      toast("Stopped")
      return
    }
    if (!canRunRef.current) {
      toast.warning("Enable at least one potion key first")
      return
    }

    const { keys, delayMs, delayError, repeatMode, repeatCount } =
      configRef.current
    const step = !delayError && delayMs !== "" ? Number(delayMs) : MIN_DELAY
    const config = {
      keys,
      delayMs: Math.max(MIN_DELAY, step),
      repeatMode,
      repeatCount: Math.max(MIN_REPEAT, Number(repeatCount) || MIN_REPEAT),
    }
    invoke("start_macro", { config })
    setRunning(true)
    toast.success("Started")
  }, [])

  useEffect(() => {
    if (!running) return
    setElapsed(0)
    setActivations(0)
    const secondTick = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(secondTick)
  }, [running])

  useEffect(() => {
    const unlistenActivation = listen<{ cycle: number }>(
      "macro-activation",
      (event) => setActivations(event.payload.cycle)
    )
    const unlistenFinished = listen("macro-finished", () => {
      setRunning(false)
      toast("Finished repeat sequence")
    })
    return () => {
      unlistenActivation.then((fn) => fn())
      unlistenFinished.then((fn) => fn())
    }
  }, [])

  return { running, setRunning, elapsed, activations, toggleRunning }
}
