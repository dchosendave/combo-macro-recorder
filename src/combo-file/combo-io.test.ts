import { describe, it, expect } from "vitest"
import { exportComboToString, importComboFromString } from "./combo-io"
import { defaultPotionConfig, defaultSkillConfig } from "@/shared/defaults"
import type { CurrentCombo } from "@/shared/types"

function sampleCombo(): CurrentCombo {
  return {
    potions: { ...defaultPotionConfig(), enabled: true, delayMs: "150", repeatMode: "count", repeatCount: "5" },
    skills: {
      ...defaultSkillConfig(),
      enabled: true,
      steps: [
        { id: "s1", type: "keydown", key: "1" },
        { id: "s2", type: "delay", ms: "50" },
      ],
    },
  }
}

describe("exportComboToString", () => {
  it("serializes to a version-3 object with 2-space formatting", () => {
    const combo = sampleCombo()
    const json = exportComboToString(combo)
    expect(JSON.parse(json)).toEqual({ version: 3, potions: combo.potions, skills: combo.skills })
    expect(json).toBe(JSON.stringify({ version: 3, potions: combo.potions, skills: combo.skills }, null, 2))
  })

  it("round-trips through import", () => {
    const combo = sampleCombo()
    expect(importComboFromString(exportComboToString(combo))).toEqual(combo)
  })
})

describe("importComboFromString", () => {
  it("merges v3 potions.keys over defaults", () => {
    const combo = importComboFromString(JSON.stringify({ version: 3, potions: { keys: { q: true } }, skills: {} }))
    expect(combo.potions.keys).toEqual({ q: true, w: true, e: true, r: true })
  })

  it.each(["string", 42, null])("treats non-array v3 skills.steps (%p) as an empty list", (steps) => {
    const combo = importComboFromString(JSON.stringify({ version: 3, potions: {}, skills: { steps } }))
    expect(combo.skills.steps).toEqual([])
  })

  it("imports v2 with the same default merge as v3", () => {
    const payload = {
      potions: { keys: { q: true }, customDelay: true, delayMs: "150" },
      skills: { steps: [{ id: "s1", type: "keydown", key: "1" }], holdRightClick: true },
    }
    const v2 = importComboFromString(JSON.stringify({ version: 2, ...payload }))
    const v3 = importComboFromString(JSON.stringify({ version: 3, ...payload }))
    expect(v2).toEqual(v3)
  })

  it.each([
    ["string", "garbage"],
    ["number", 42],
    ["null", null],
  ])("degrades malformed %s potions/skills fields to defaults", (_label, value) => {
    const combo = importComboFromString(JSON.stringify({ version: 3, potions: value, skills: value }))
    expect(combo.potions).toEqual(defaultPotionConfig())
    expect(combo.skills).toEqual(defaultSkillConfig())
  })

  it("throws Invalid JSON for unparseable input", () => {
    expect(() => importComboFromString("not json")).toThrow("Invalid JSON")
  })

  it.each(["42", "null", '"str"'])("rejects non-object JSON (%s)", (json) => {
    expect(() => importComboFromString(json)).toThrow("Invalid format")
  })

  it.each([99, 1])("rejects unsupported version %d", (version) => {
    expect(() => importComboFromString(JSON.stringify({ version }))).toThrow("Unsupported format")
  })
})
