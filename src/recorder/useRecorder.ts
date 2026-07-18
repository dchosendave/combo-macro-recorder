import { useCallback, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"
import type { SkillStep } from "@/shared/types"

type RecordedEvent = {
  timestampMs: number
  key: string
  action: "keydown" | "keyup"
}

function eventsToSteps(events: RecordedEvent[]): SkillStep[] {
  const steps: SkillStep[] = []

  for (let i = 0; i < events.length; i++) {
    const event = events[i]

    if (i > 0) {
      const delay = event.timestampMs - events[i - 1].timestampMs
      if (delay > 0) {
        steps.push({ id: crypto.randomUUID(), type: "delay", ms: String(delay) })
      }
    }

    steps.push({
      id: crypto.randomUUID(),
      type: event.action,
      key: event.key,
    })
  }

  return steps
}

export function useRecorder() {
  const [isRecording, setIsRecording] = useState(false)

  const startRecording = useCallback(async () => {
    try {
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
  }, [])

  return { isRecording, startRecording, stopRecording }
}
