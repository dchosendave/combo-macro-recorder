import { describe, expect, it } from "vitest"
import { analyzeSkillSteps, eventCodeToSkillKey, normalizeSkillKey, SKILL_KEY_GROUPS } from "./skill-keys"

describe("skill key vocabulary", () => {
  it("normalizes characters and supported named keys", () => {
    expect(normalizeSkillKey(" a ")).toBe("A")
    expect(normalizeSkillKey("pageup")).toBe("PageUp")
    expect(normalizeSkillKey("f24")).toBe("F24")
    expect(normalizeSkillKey("Num9")).toBe("Num9")
    expect(normalizeSkillKey("F25")).toBeNull()
    expect(normalizeSkillKey("unknown")).toBeNull()
  })

  it("keeps advanced keys internal while exposing a focused picker", () => {
    expect(SKILL_KEY_GROUPS.map((group) => group.label)).toEqual([
      "Letters", "Numbers", "Common keys", "Function keys",
    ])
    expect(SKILL_KEY_GROUPS[3].keys).toHaveLength(12)
    expect(normalizeSkillKey("F24")).toBe("F24")
    expect(normalizeSkillKey("Num9")).toBe("Num9")
    expect(normalizeSkillKey(";")).toBe(";")
  })

  it("maps physical keyboard codes to playback tokens", () => {
    expect(eventCodeToSkillKey("KeyQ")).toBe("Q")
    expect(eventCodeToSkillKey("Numpad4")).toBe("Num4")
    expect(eventCodeToSkillKey("ArrowLeft")).toBe("Left")
    expect(eventCodeToSkillKey("ShiftLeft")).toBeNull()
  })

  it("reports invalid steps and unmatched keydowns independently", () => {
    expect(analyzeSkillSteps([
      { id: "1", type: "keydown", key: "A" },
      { id: "2", type: "keydown", key: "Space" },
      { id: "3", type: "keyup", key: "A" },
      { id: "4", type: "keyup", key: "not-a-key" },
    ])).toEqual({ invalidStepIds: ["4"], unmatchedKeydowns: ["Space"] })
  })
})
