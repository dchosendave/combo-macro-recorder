import { describe, it, expect } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { defaultSkillConfig } from "@/shared/defaults"
import { useSkillSettings } from "./use-skill-settings"
import type { SkillStep } from "@/shared/types"

const THREE_STEPS: SkillStep[] = [
  { id: "s1", type: "keydown", key: "1" },
  { id: "s2", type: "keyup", key: "1" },
  { id: "s3", type: "delay", ms: "100" },
]

describe("useSkillSettings", () => {
  it("appends keydown/keyup/delay steps with unique non-empty ids", () => {
    const { result } = renderHook(() => useSkillSettings(defaultSkillConfig()))
    act(() => {
      result.current.addSkillKeydown()
      result.current.addSkillKeyup()
      result.current.addSkillDelay()
    })
    expect(result.current.skillSteps).toHaveLength(3)
    const [kd, ku, d] = result.current.skillSteps
    expect(kd).toMatchObject({ type: "keydown", key: "" })
    expect(ku).toMatchObject({ type: "keyup", key: "" })
    if (d.type === "delay") expect(d.ms).toBe("100")
    const ids = result.current.skillSteps.map((s) => s.id)
    expect(new Set(ids).size).toBe(3)
    for (const id of ids) expect(id).not.toBe("")
  })

  it("updateSkillStep patches key and ms in place", () => {
    const { result } = renderHook(() => useSkillSettings({ ...defaultSkillConfig(), steps: THREE_STEPS }))
    act(() => {
      result.current.updateSkillStep("s1", { key: "A" })
      result.current.updateSkillStep("s3", { ms: "250" })
    })
    const [kd, , d] = result.current.skillSteps
    if (kd.type === "keydown") expect(kd.key).toBe("A")
    if (d.type === "delay") expect(d.ms).toBe("250")
    expect(result.current.skillSteps[1]).toEqual(THREE_STEPS[1])
  })

  it("moveSkillStepUp swaps with the previous step and no-ops at the top", () => {
    const { result } = renderHook(() => useSkillSettings({ ...defaultSkillConfig(), steps: THREE_STEPS }))
    act(() => result.current.moveSkillStepUp("s2"))
    expect(result.current.skillSteps.map((s) => s.id)).toEqual(["s2", "s1", "s3"])
    act(() => result.current.moveSkillStepUp("s2"))
    expect(result.current.skillSteps.map((s) => s.id)).toEqual(["s2", "s1", "s3"])
  })

  it("moveSkillStepDown swaps with the next step and no-ops at the bottom", () => {
    const { result } = renderHook(() => useSkillSettings({ ...defaultSkillConfig(), steps: THREE_STEPS }))
    act(() => result.current.moveSkillStepDown("s1"))
    expect(result.current.skillSteps.map((s) => s.id)).toEqual(["s2", "s1", "s3"])
    act(() => result.current.moveSkillStepDown("s3"))
    expect(result.current.skillSteps.map((s) => s.id)).toEqual(["s2", "s1", "s3"])
    act(() => result.current.moveSkillStepDown("missing"))
    expect(result.current.skillSteps.map((s) => s.id)).toEqual(["s2", "s1", "s3"])
  })

  it("duplicateSkillStep inserts a copy with a new id", () => {
    const { result } = renderHook(() => useSkillSettings({ ...defaultSkillConfig(), steps: THREE_STEPS }))
    act(() => result.current.duplicateSkillStep("s2"))
    expect(result.current.skillSteps.map((s) => s.id)).toEqual(["s1", "s2", expect.any(String), "s3"])
    const dup = result.current.skillSteps[2]
    expect(dup.id).not.toBe("s2")
    expect(dup).toEqual({ ...result.current.skillSteps[1], id: dup.id })
  })

  it("removeSkillStep removes the step", () => {
    const { result } = renderHook(() => useSkillSettings({ ...defaultSkillConfig(), steps: THREE_STEPS }))
    act(() => result.current.removeSkillStep("s2"))
    expect(result.current.skillSteps.map((s) => s.id)).toEqual(["s1", "s3"])
  })

  it("undoSteps reverts the last addition and canUndo follows", () => {
    const { result } = renderHook(() => useSkillSettings(defaultSkillConfig()))
    expect(result.current.canUndo).toBe(false)
    act(() => result.current.addSkillKeydown())
    expect(result.current.skillSteps).toHaveLength(1)
    expect(result.current.canUndo).toBe(true)
    act(() => result.current.undoSteps())
    expect(result.current.skillSteps).toHaveLength(0)
    expect(result.current.canUndo).toBe(false)
  })

  it("persisted exposes the current state shape", () => {
    const { result } = renderHook(() => useSkillSettings(defaultSkillConfig()))
    expect(result.current.persisted).toEqual({
      enabled: false,
      holdRightClick: false,
      steps: [],
      labelStyle: "abbreviation",
      repeatMode: "loop",
      repeatCount: "1",
    })
  })

  it("skillsCanRun requires an enabled keydown step with a supported key", () => {
    const { result } = renderHook(() => useSkillSettings(defaultSkillConfig()))
    expect(result.current.skillsCanRun).toBe(false)
    act(() => result.current.addSkillKeydown())
    expect(result.current.skillsCanRun).toBe(false)
    act(() => result.current.setSkillsEnabled(true))
    expect(result.current.skillsCanRun).toBe(false)
    const step = result.current.skillSteps[0]
    act(() => result.current.updateSkillStep(step.id, { key: "Space" }))
    expect(result.current.skillsCanRun).toBe(true)
  })
})
