import { useCallback, useEffect, useRef, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"
import { eventsToSteps, type RecordedEvent } from "./events-to-steps"
import type { SkillStep } from "@/shared/types"

/** Records real keystrokes system-wide via the backend polling thread and converts them into skill steps (delay + keydown/keyup). */
export const RECORD_COUNTDOWN_KEY = "combo-macro-record-countdown"

function savedCountdown(): number {
  const value = Number(localStorage.getItem(RECORD_COUNTDOWN_KEY) ?? "3")
  return Number.isFinite(value) ? Math.min(60, Math.max(1, Math.round(value))) : 3
}

export function useRecorder(countdownSeconds = savedCountdown()) {
  const [isRecording, setIsRecording] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const countdownTokenRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resolveTimerRef = useRef<(() => void) | null>(null)

  const cancelCountdown = useCallback(() => {
    countdownTokenRef.current += 1
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    resolveTimerRef.current?.()
    resolveTimerRef.current = null
    setCountdown(null)
  }, [])

  const startRecording = useCallback(async () => {
    if (isRecording || countdown !== null) return
    const token = ++countdownTokenRef.current
    try {
      for (let remaining = countdownSeconds; remaining > 0; remaining -= 1) {
        setCountdown(remaining)
        await new Promise<void>((resolve) => {
          resolveTimerRef.current = resolve
          timerRef.current = setTimeout(resolve, 1000)
        })
        timerRef.current = null
        resolveTimerRef.current = null
        if (token !== countdownTokenRef.current) return
      }
      setCountdown(null)
      await invoke("start_recording")
      setIsRecording(true)
      toast.info("Recording... press your combo, then click Stop")
    } catch (e) {
      toast.error(`Failed to start recording: ${e}`)
    }
  }, [])

  const stopRecording = useCallback(async (): Promise<SkillStep[] | null> => {
    try {
      const events = await invoke<RecordedEvent[]>("stop_recording")
      setIsRecording(false)

      if (events.length === 0) {
        toast.error("No keys recorded")
        return null
      }

      const steps = eventsToSteps(events)
      toast.success(`Recorded ${steps.length} steps`)
      return steps
    } catch (e) {
      setIsRecording(false)
      toast.error(`Failed to stop recording: ${e}`)
      return null
    }
  }, [countdown, countdownSeconds, isRecording])

  useEffect(() => {
    const cancel = () => {
      cancelCountdown()
      setIsRecording((active) => {
        if (active) {
          invoke("stop_recording").catch(() => {})
          toast.info("Recording cancelled by emergency stop")
        }
        return false
      })
    }
    window.addEventListener("macro-emergency-stop", cancel)
    return () => window.removeEventListener("macro-emergency-stop", cancel)
  }, [cancelCountdown])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && countdown !== null) cancelCountdown()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [cancelCountdown, countdown])

  useEffect(() => cancelCountdown, [cancelCountdown])

  return { isRecording, countdown, startRecording, stopRecording, cancelCountdown }
}
