import { describe, expect, it, vi } from "vitest"
import {
  adjustSelectedDelays,
  copySelectedSteps,
  duplicateSelectedSteps,
  pasteSkillSteps,
  reorderSelectedSteps,
  setSelectedStepsDisabled,
} from "./step-selection"
import type { SkillStep } from "@/shared/types"

const STEPS: SkillStep[] = [
  { id: "a", type: "keydown", key: "A" },
  { id: "b", type: "delay", ms: "100" },
  { id: "c", type: "keyup", key: "A" },
  { id: "d", type: "delay", ms: "20" },
]

describe("multi-step editing", () => {
  it("duplicates selected steps as one ordered block", () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("00000000-0000-0000-0000-000000000001")
      .mockReturnValueOnce("00000000-0000-0000-0000-000000000002")
    const result = duplicateSelectedSteps(STEPS, new Set(["b", "c"]))
    expect(result.steps.map((step) => step.id)).toEqual(["a", "b", "c", "00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002", "d"])
    expect([...result.selectedIds]).toEqual(["00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002"])
  })

  it("copies selected steps in timeline order without sharing objects", () => {
    const copied = copySelectedSteps(STEPS, new Set(["c", "a"]))
    expect(copied.map((step) => step.id)).toEqual(["a", "c"])
    expect(copied[0]).not.toBe(STEPS[0])
  })

  it("pastes new steps after the last selected step and selects the copies", () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("00000000-0000-0000-0000-000000000003")
      .mockReturnValueOnce("00000000-0000-0000-0000-000000000004")
    const copied = copySelectedSteps(STEPS, new Set(["a", "b"]))
    const result = pasteSkillSteps(STEPS, copied, new Set(["c"]))
    expect(result.steps.map((step) => step.id)).toEqual([
      "a", "b", "c",
      "00000000-0000-0000-0000-000000000003",
      "00000000-0000-0000-0000-000000000004",
      "d",
    ])
    expect([...result.selectedIds]).toEqual([
      "00000000-0000-0000-0000-000000000003",
      "00000000-0000-0000-0000-000000000004",
    ])
  })

  it("pastes at the end when nothing is selected", () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("00000000-0000-0000-0000-000000000005")
    const result = pasteSkillSteps(STEPS, [STEPS[0]], new Set())
    expect(result.steps.at(-1)?.id).toBe("00000000-0000-0000-0000-000000000005")
  })

  it("moves a non-contiguous selection together while preserving its order", () => {
    expect(reorderSelectedSteps(STEPS, new Set(["a", "c"]), "d", "below").map((step) => step.id))
      .toEqual(["b", "d", "a", "c"])
  })

  it("sets, adds, and subtracts selected delays without going below zero", () => {
    const selected = new Set(["b", "d"])
    const added = adjustSelectedDelays(STEPS, selected, 25, "add")
    expect(added.filter((step) => step.type === "delay").map((step) => step.ms)).toEqual(["125", "45"])
    const subtracted = adjustSelectedDelays(STEPS, selected, 50, "subtract")
    expect(subtracted.filter((step) => step.type === "delay").map((step) => step.ms)).toEqual(["50", "0"])
    const set = adjustSelectedDelays(STEPS, selected, 80, "set")
    expect(set.filter((step) => step.type === "delay").map((step) => step.ms)).toEqual(["80", "80"])
  })

  it("enables or disables only the selected steps", () => {
    const disabled = setSelectedStepsDisabled(STEPS, new Set(["a", "c"]), true)
    expect(disabled.map((step) => !!step.disabled)).toEqual([true, false, true, false])
    const enabled = setSelectedStepsDisabled(disabled, new Set(["a"]), false)
    expect(enabled.map((step) => !!step.disabled)).toEqual([false, false, true, false])
  })
})
