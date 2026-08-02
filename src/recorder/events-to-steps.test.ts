import { describe, it, expect } from "vitest"
import { eventsToSteps } from "./events-to-steps"
import type { RecordedEvent } from "./events-to-steps"
import type { SkillStep } from "@/shared/types"

function stripId(steps: SkillStep[]) {
  return steps.map(({ id: _id, ...rest }) => rest)
}

describe("eventsToSteps", () => {
  it("returns no steps for an empty event list", () => {
    expect(eventsToSteps([])).toEqual([])
  })

  it("converts a single keydown with no leading delay", () => {
    const events: RecordedEvent[] = [{ timestampMs: 0, key: "A", action: "keydown" }]
    expect(stripId(eventsToSteps(events))).toEqual([{ type: "keydown", key: "A" }])
  })

  it("inserts a delay between consecutive events", () => {
    const events: RecordedEvent[] = [
      { timestampMs: 0, key: "A", action: "keydown" },
      { timestampMs: 120, key: "B", action: "keyup" },
    ]
    expect(stripId(eventsToSteps(events))).toEqual([
      { type: "keydown", key: "A" },
      { type: "delay", ms: "120" },
      { type: "keyup", key: "B" },
    ])
  })

  it("skips a zero-delta delay between events", () => {
    const events: RecordedEvent[] = [
      { timestampMs: 0, key: "A", action: "keydown" },
      { timestampMs: 120, key: "B", action: "keydown" },
      { timestampMs: 120, key: "C", action: "keyup" },
    ]
    expect(stripId(eventsToSteps(events))).toEqual([
      { type: "keydown", key: "A" },
      { type: "delay", ms: "120" },
      { type: "keydown", key: "B" },
      { type: "keyup", key: "C" },
    ])
  })

  it("gives every step a non-empty string id", () => {
    const events: RecordedEvent[] = [
      { timestampMs: 0, key: "A", action: "keydown" },
      { timestampMs: 120, key: "B", action: "keyup" },
    ]
    const steps = eventsToSteps(events)
    expect(steps.length).toBeGreaterThan(0)
    for (const step of steps) {
      expect(typeof step.id).toBe("string")
      expect(step.id.length).toBeGreaterThan(0)
    }
  })
})
