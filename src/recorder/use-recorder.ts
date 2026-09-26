import { useCallback, useEffect, useRef, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"
import { eventsToSteps, type RecordedEvent } from "./events-to-steps"
import type { SkillStep } from "@/shared/types"

export const RECORD_COUNTDOWN_KEY = "combo-macro-record-countdown"

function savedCountdown(): number {
  const value = Number(localStorage.getItem(RECORD_COUNTDOWN_KEY) ?? "3")
  return Number.isFinite(value) ? Math.min(60, Math.max(1, Math.round(value))) : 3
}

// The native recorder is a singleton. Preserve command order across tab remounts.
let recordingQueue: Promise<unknown> = Promise.resolve()
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = recordingQueue.then(operation, operation)
  recordingQueue = result.catch(() => {})
  return result
}

export function useRecorder(countdownSeconds = savedCountdown()) {
  const [isRecording, setIsRecording] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const tokenRef = useRef(0)
  const busyRef = useRef(false)
  const activeRef = useRef(false)
  const mountedRef = useRef(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resolveTimerRef = useRef<(() => void) | null>(null)

  const cancelCountdown = useCallback(() => {
    tokenRef.current += 1
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    resolveTimerRef.current?.()
    resolveTimerRef.current = null
    if (mountedRef.current) setCountdown(null)
  }, [])

  const cancelRecording = useCallback(() => {
    cancelCountdown()
    void enqueue(async () => {
      if (activeRef.current) {
        await invoke("stop_recording")
        activeRef.current = false
      }
      busyRef.current = false
      if (mountedRef.current) setIsRecording(false)
    }).catch((error) => toast.error(`Failed to cancel recording: ${error}`))
  }, [cancelCountdown])

  const startRecording = useCallback(async () => {
    if (busyRef.current) return
    busyRef.current = true
    const token = ++tokenRef.current
    try {
      for (let remaining = countdownSeconds; remaining > 0; remaining -= 1) {
        setCountdown(remaining)
        await new Promise<void>((resolve) => {
          resolveTimerRef.current = resolve
          timerRef.current = setTimeout(resolve, 1000)
        })
        timerRef.current = null
        resolveTimerRef.current = null
        if (token !== tokenRef.current) return
      }
      setCountdown(null)
      await enqueue(async () => {
        if (token !== tokenRef.current) return
        await invoke("start_recording")
        activeRef.current = true
        if (token !== tokenRef.current || !mountedRef.current) {
          await invoke("stop_recording")
          activeRef.current = false
          return
        }
        setIsRecording(true)
        toast.info("Recording... press your combo, then click Stop")
      })
    } catch (e) {
      toast.error(`Failed to start recording: ${e}`)
    } finally {
      busyRef.current = activeRef.current
    }
  }, [countdownSeconds])

  const stopRecording = useCallback(async (): Promise<SkillStep[] | null> => {
    cancelCountdown()
    try {
      const events = await enqueue(async () => {
        const captured = await invoke<RecordedEvent[]>("stop_recording")
        activeRef.current = false
        busyRef.current = false
        return captured
      })
      if (mountedRef.current) setIsRecording(false)
      if (events.length === 0) {
        toast.error("No keys recorded")
        return null
      }
      const steps = eventsToSteps(events)
      toast.success(`Recorded ${steps.length} steps`)
      return steps
    } catch (e) {
      toast.error(`Failed to stop recording: ${e}`)
      return null
    }
  }, [cancelCountdown])

  useEffect(() => {
    mountedRef.current = true
    window.addEventListener("macro-emergency-stop", cancelRecording)
    return () => {
      mountedRef.current = false
      window.removeEventListener("macro-emergency-stop", cancelRecording)
      cancelRecording()
    }
  }, [cancelRecording])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && countdown !== null) cancelCountdown()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [cancelCountdown, countdown])

  return { isRecording, countdown, startRecording, stopRecording, cancelCountdown }
}