import type { SkillStep } from "@/shared/types"

export type RecordedEvent = {
  timestampMs: number
  key: string
  action: "keydown" | "keyup"
}

/** Converts recorded keystroke events (timestamps) into skill steps: a delay between consecutive events (when positive), then the keydown/keyup itself. */
export function eventsToSteps(events: RecordedEvent[]): SkillStep[] {
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
