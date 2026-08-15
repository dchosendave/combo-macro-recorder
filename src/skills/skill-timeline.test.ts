import { describe, expect, it } from "vitest"
import { buildTimeline, clampTimelineScale, fitTimelineScale } from "./skill-timeline"
import type { SkillStep } from "@/shared/types"

describe("skill timeline", () => {
  it("builds effective positions using playback speed and ignores disabled delays", () => {
    const steps: SkillStep[] = [
      { id: "a", type: "delay", ms: "200" },
      { id: "b", type: "delay", ms: "500", disabled: true },
      { id: "c", type: "keydown", key: "Q" },
    ]

    expect(buildTimeline(steps, "2")).toEqual({
      items: [
        { step: steps[0], startMs: 0, endMs: 100 },
        { step: steps[1], startMs: 100, endMs: 100 },
        { step: steps[2], startMs: 100, endMs: 100 },
      ],
      totalMs: 100,
    })
  })

  it("keeps manual zoom within readable bounds", () => {
    expect(clampTimelineScale(0.01)).toBe(0.1)
    expect(clampTimelineScale(1.25)).toBe(1.25)
    expect(clampTimelineScale(10)).toBe(3)
  })

  it("fits short and long timelines within scale bounds", () => {
    expect(fitTimelineScale(0)).toBe(1)
    expect(fitTimelineScale(100)).toBe(1.5)
    expect(fitTimelineScale(10_000)).toBe(0.15)
  })
})
