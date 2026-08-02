import { useCallback, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"
import { eventsToSteps, type RecordedEvent } from "./events-to-steps"
import type { SkillStep } from "@/shared/types"

/** Records real keystrokes system-wide via the backend polling thread and converts them into skill steps (delay + keydown/keyup). */
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
