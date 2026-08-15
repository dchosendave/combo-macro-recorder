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
  it("serializes to a version-4 object with 2-space formatting", () => {
    const combo = sampleCombo()
    const json = exportComboToString(combo)
    expect(JSON.parse(json)).toEqual({ version: 4, potions: combo.potions, skills: combo.skills })
    expect(json).toBe(JSON.stringify({ version: 4, potions: combo.potions, skills: combo.skills }, null, 2))
  })

  it("round-trips through import", () => {
    const combo = sampleCombo()
    expect(importComboFromString(exportComboToString(combo))).toEqual(combo)
  })

  it("persists disabled steps", () => {
    const combo = sampleCombo()
    combo.skills.steps[0].disabled = true
    expect(importComboFromString(exportComboToString(combo)).skills.steps[0].disabled).toBe(true)
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

  it("imports v3 steps as enabled by default", () => {
    const combo = importComboFromString(JSON.stringify({
      version: 3,
      potions: {},
      skills: { steps: [{ id: "s1", type: "keydown", key: "1" }] },
    }))
    expect(combo.skills.steps[0].disabled).toBeUndefined()
  })

  it("repairs missing and duplicate step ids while preserving unique ids", () => {
    const combo = importComboFromString(JSON.stringify({
      version: 4,
      skills: {
        steps: [
          { id: "keep", type: "keydown", key: "A" },
          { id: "keep", type: "delay", ms: 20 },
          { type: "keyup", key: "A" },
        ],
      },
    }))
    const ids = combo.skills.steps.map((step) => step.id)
    expect(ids[0]).toBe("keep")
    expect(ids[1]).not.toBe("keep")
    expect(ids[2]).toBeTruthy()
    expect(new Set(ids).size).toBe(3)
    expect(combo.skills.steps[1]).toMatchObject({ type: "delay", ms: "20" })
  })

  it("normalizes field types and removes unknown properties", () => {
    const combo = importComboFromString(JSON.stringify({
      version: 4,
      potions: {
        enabled: "yes",
        keys: { q: false, w: "no", unknown: true },
        delayMs: 25,
        repeatMode: "invalid",
        repeatCount: 4,
        extra: "discard",
      },
      skills: {
        enabled: true,
        holdRightClick: "yes",
        labelStyle: "invalid",
        repeatMode: "count",
        repeatCount: 3,
        playbackSpeed: 1.5,
        steps: [],
        extra: "discard",
      },
    }))
    expect(combo.potions).toEqual({
      ...defaultPotionConfig(),
      keys: { q: false, w: true, e: true, r: true },
      delayMs: "25",
      repeatCount: "4",
    })
    expect(combo.skills).toEqual({
      ...defaultSkillConfig(),
      enabled: true,
      repeatMode: "count",
      repeatCount: "3",
      playbackSpeed: "1.5",
    })
  })

  it.each([
    [{ type: "unknown" }, "unsupported type"],
    [{ type: "keydown", key: 1 }, "key must be a string"],
    [{ type: "delay", ms: null }, "delay ms must be a string or number"],
    [{ type: "keyup", key: "A", disabled: "yes" }, "disabled must be boolean"],
  ])("rejects structurally invalid steps with their index", (step, reason) => {
    const json = JSON.stringify({ version: 4, skills: { steps: [step] } })
    expect(() => importComboFromString(json)).toThrow(`Invalid skill step at index 0: ${reason}`)
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
