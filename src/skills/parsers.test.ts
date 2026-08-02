import { describe, it, expect } from "vitest"
import { parseCombo, parseJitbit, parseJitbitFile } from "./parsers"
import type { SkillStep } from "@/shared/types"

function stripId(steps: SkillStep[]) {
  return steps.map(({ id: _id, ...rest }) => rest)
}

// Inline .mcr-style fixtures (the old macros/ directory was gitignored and
// absent from fresh clones, which broke `npm test`).
const FIXTURES: Record<string, string> = {
  "skill-combo.mcr": [
    "DELAY : 100",
    "Keyboard : D1 : KeyDown",
    "Keyboard : D1 : KeyUp",
    "Keyboard : D2 : KeyDown",
    "DELAY : 50",
    "Keyboard : D2 : KeyUp",
    "",
  ].join("\n"),
  "named-keys.mcr": [
    "Keyboard : Space : KeyDown",
    "DELAY : 30",
    "Keyboard : Space : KeyUp",
    "Keyboard : F1 : KeyDown",
    "Keyboard : F1 : KeyUp",
    "Keyboard : Num0 : KeyDown",
    "Keyboard : Num0 : KeyUp",
    "",
  ].join("\n"),
}

describe("parseJitbit from .mcr fixtures", () => {
  it("parses skill-combo.mcr correctly", () => {
    expect(stripId(parseJitbit(FIXTURES["skill-combo.mcr"]))).toEqual([
      { type: "delay", ms: "100" },
      { type: "keydown", key: "1" },
      { type: "keyup", key: "1" },
      { type: "keydown", key: "2" },
      { type: "delay", ms: "50" },
      { type: "keyup", key: "2" },
    ])
  })

  it("parses named-keys.mcr correctly", () => {
    expect(stripId(parseJitbit(FIXTURES["named-keys.mcr"]))).toEqual([
      { type: "keydown", key: "SPACE" },
      { type: "delay", ms: "30" },
      { type: "keyup", key: "SPACE" },
      { type: "keydown", key: "F1" },
      { type: "keyup", key: "F1" },
      { type: "keydown", key: "NUM0" },
      { type: "keyup", key: "NUM0" },
    ])
  })
})

describe("parseJitbitFile strict file import", () => {
  it("accepts pure keyboard macros", () => {
    const result = parseJitbitFile("DELAY : 100\nKeyboard : D1 : KeyDown\nKeyboard : D1 : KeyUp\n")
    expect("steps" in result).toBe(true)
    if ("steps" in result) {
      expect(stripId(result.steps)).toEqual([
        { type: "delay", ms: "100" },
        { type: "keydown", key: "1" },
        { type: "keyup", key: "1" },
      ])
    }
  })

  it("rejects mouse-movement rows with the offending line", () => {
    const result = parseJitbitFile(
      "DELAY : 50\nMoveMouse : 100 : 200\nKeyboard : D1 : KeyDown\n",
    )
    expect("rejected" in result).toBe(true)
    if ("rejected" in result) {
      expect(result.rejected.line).toBe(2)
      expect(result.rejected.text).toBe("MoveMouse : 100 : 200")
    }
  })

  it("rejects mixed keyboard + mouse macros entirely", () => {
    const result = parseJitbitFile(
      "Keyboard : D1 : KeyDown\nClickMouse : LEFT : 1\nKeyboard : D1 : KeyUp\n",
    )
    expect("rejected" in result).toBe(true)
  })

  it("strips a single RightButtonDown at the top", () => {
    const result = parseJitbitFile(
      "Mouse : 0 : 0 : RightButtonDown : 0 : 1 : 0\nKeyboard : D1 : KeyDown\nKeyboard : D1 : KeyUp",
    )
    expect("steps" in result).toBe(true)
    if ("steps" in result) {
      expect(stripId(result.steps)).toEqual([
        { type: "keydown", key: "1" },
        { type: "keyup", key: "1" },
      ])
    }
  })

  it("strips a single RightButtonDown at the end", () => {
    const result = parseJitbitFile(
      "Keyboard : D1 : KeyDown\nMouse : 0 : 0 : RightButtonDown : 0 : 1 : 0",
    )
    expect("steps" in result).toBe(true)
    if ("steps" in result) {
      expect(result.steps).toHaveLength(1)
    }
  })

  it("rejects a RightButtonDown in the middle of the macro", () => {
    const result = parseJitbitFile(
      "Keyboard : D1 : KeyDown\nMouse : 0 : 0 : RightButtonDown : 0 : 1 : 0\nKeyboard : D1 : KeyUp",
    )
    expect("rejected" in result).toBe(true)
    if ("rejected" in result) {
      expect(result.rejected.line).toBe(2)
      expect(result.rejected.reason).toContain("start or end")
    }
  })

  it("rejects multiple RightButtonDown rows", () => {
    const result = parseJitbitFile(
      "Mouse : 0 : 0 : RightButtonDown : 0 : 1 : 0\nKeyboard : D1 : KeyDown\nMouse : 5 : 5 : RightButtonDown : 0 : 1 : 0",
    )
    expect("rejected" in result).toBe(true)
    if ("rejected" in result) {
      expect(result.rejected.line).toBe(3)
    }
  })

  it("rejects unknown command rows", () => {
    const result = parseJitbitFile("Text : hello\nKeyboard : A : KeyDown")
    expect("rejected" in result).toBe(true)
    if ("rejected" in result) {
      expect(result.rejected.line).toBe(1)
    }
  })

  it("keeps keyboard rows with unsupported key tokens and skips the key", () => {
    const result = parseJitbitFile("Keyboard : LCTRL : KeyDown\nKeyboard : S : KeyDown")
    expect("steps" in result).toBe(true)
    if ("steps" in result) {
      expect(result.steps).toHaveLength(1)
      expect(result.steps[0]).toMatchObject({ type: "keydown", key: "S" })
    }
  })

  it("empty file yields no steps", () => {
    const result = parseJitbitFile("\n  \n")
    expect("steps" in result).toBe(true)
    if ("steps" in result) {
      expect(result.steps).toEqual([])
    }
  })

  it("reports the original file line number even with blank rows", () => {
    const result = parseJitbitFile("DELAY : 10\n\n\nScrollMouse : UP : 1")
    expect("rejected" in result).toBe(true)
    if ("rejected" in result) {
      expect(result.rejected.line).toBe(4)
    }
  })
})

describe("parseJitbit edge cases", () => {
  it("handles empty string", () => {
    expect(parseJitbit("")).toEqual([])
  })

  it("handlines with only whitespace", () => {
    expect(parseJitbit("  \n  \n  ")).toEqual([])
  })

  it("handles a single keydown", () => {
    const result = parseJitbit("Keyboard : D5 : KeyDown")
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ type: "keydown", key: "5" })
  })

  it("handles a single keyup", () => {
    const result = parseJitbit("Keyboard : A : KeyUp")
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ type: "keyup", key: "A" })
  })

  it("handles a single delay", () => {
    const result = parseJitbit("DELAY : 250")
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ type: "delay", ms: "250" })
  })

  it("accepts named tokens (F12, Space) and skips unknown ones", () => {
    const result = parseJitbit(
      "Keyboard : F12 : KeyDown\nKeyboard : Space : KeyUp\nKeyboard : XYZ : KeyDown",
    )
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ type: "keydown", key: "F12" })
    expect(result[1]).toMatchObject({ type: "keyup", key: "SPACE" })
  })

  it("is case-insensitive", () => {
    const result = parseJitbit("KEYBOARD : D1 : KEYDOWN\ndelay : 50")
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ type: "keydown", key: "1" })
    expect(result[1]).toMatchObject({ type: "delay", ms: "50" })
  })

  it("preserves lowercase single-letter keys", () => {
    const result = parseJitbit("keyboard : a : keydown")
    expect(result[0]).toMatchObject({ type: "keydown", key: "a" })
  })

  it("strips D prefix from d0-d9 (lowercase)", () => {
    const result = parseJitbit("keyboard : d0 : keydown\nkeyboard : d9 : keyup")
    expect(result[0]).toMatchObject({ type: "keydown", key: "0" })
    expect(result[1]).toMatchObject({ type: "keyup", key: "9" })
  })
})

describe("parseCombo", () => {
  it("builds keydowns with inter-key delays, reverse-order keyups, and the pre-keyup delay", () => {
    expect(stripId(parseCombo("1,2", "85,45"))).toEqual([
      { type: "keydown", key: "1" },
      { type: "delay", ms: "85" },
      { type: "keydown", key: "2" },
      { type: "delay", ms: "45" },
      { type: "keyup", key: "2" },
      { type: "keyup", key: "1" },
    ])
  })

  it("uses the third delay as the final rest delay", () => {
    expect(stripId(parseCombo("1", "85,100"))).toEqual([
      { type: "keydown", key: "1" },
      { type: "delay", ms: "85" },
      { type: "keyup", key: "1" },
      { type: "delay", ms: "100" },
    ])
  })

  it("omits missing middle and rest delays", () => {
    expect(stripId(parseCombo("1,2", "85"))).toEqual([
      { type: "keydown", key: "1" },
      { type: "delay", ms: "85" },
      { type: "keydown", key: "2" },
      { type: "keyup", key: "2" },
      { type: "keyup", key: "1" },
    ])
  })

  it("returns no steps for empty input", () => {
    expect(parseCombo("", "")).toEqual([])
  })

  it("trims whitespace around keys", () => {
    expect(stripId(parseCombo(" a , b ", "10"))).toEqual([
      { type: "keydown", key: "a" },
      { type: "delay", ms: "10" },
      { type: "keydown", key: "b" },
      { type: "keyup", key: "b" },
      { type: "keyup", key: "a" },
    ])
  })
})
