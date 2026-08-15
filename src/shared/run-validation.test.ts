import { describe, it, expect } from "vitest"
import { derivePotionRun, deriveSkillRun } from "@/shared/run-validation"
import { toRunnerInputs } from "@/runner/runner-inputs"
import { defaultPotionConfig, defaultSkillConfig } from "@/shared/defaults"
import type { CurrentCombo, PotionConfig, SkillConfig } from "@/shared/types"

function potionConfig(overrides: Partial<PotionConfig> = {}): PotionConfig {
  return { ...defaultPotionConfig(), ...overrides }
}

function skillConfig(overrides: Partial<SkillConfig> = {}): SkillConfig {
  return { ...defaultSkillConfig(), ...overrides }
}

const KEY_Q = { q: true, w: false, e: false, r: false }

describe("derivePotionRun", () => {
  it("cannot run when disabled", () => {
    const r = derivePotionRun(potionConfig({ enabled: false }))
    expect(r.canRun).toBe(false)
  })

  it("cannot run when no potion key is enabled", () => {
    const r = derivePotionRun(potionConfig({ enabled: true, keys: { q: false, w: false, e: false, r: false } }))
    expect(r.canRun).toBe(false)
  })

  it("runs with a key enabled, default delay and loop mode (MIN_DELAY fallback)", () => {
    const r = derivePotionRun(potionConfig({ enabled: true, keys: KEY_Q, customDelay: false, repeatMode: "loop" }))
    expect(r.canRun).toBe(true)
    expect(r.delayError).toBe(false)
    expect(r.repeatError).toBe(false)
    expect(r.config.delayMs).toBe(2)
  })

  it("flags a custom delay below MIN_DELAY and falls back to MIN_DELAY", () => {
    const r = derivePotionRun(potionConfig({ enabled: true, keys: KEY_Q, customDelay: true, delayMs: "1" }))
    expect(r.delayError).toBe(true)
    expect(r.canRun).toBe(false)
    expect(r.config.delayMs).toBe(2)
  })

  it("treats an empty delay string as no error with a MIN_DELAY fallback", () => {
    const r = derivePotionRun(potionConfig({ enabled: true, keys: KEY_Q, customDelay: true, delayMs: "" }))
    expect(r.delayError).toBe(false)
    expect(r.canRun).toBe(true)
    expect(r.config.delayMs).toBe(2)
  })

  it("passes a valid custom delay through", () => {
    const r = derivePotionRun(potionConfig({ enabled: true, keys: KEY_Q, customDelay: true, delayMs: "150" }))
    expect(r.delayError).toBe(false)
    expect(r.repeatError).toBe(false)
    expect(r.config.delayMs).toBe(150)
  })

  it("flags an empty repeat count in count mode", () => {
    const r = derivePotionRun(potionConfig({ enabled: true, keys: KEY_Q, repeatMode: "count", repeatCount: "" }))
    expect(r.repeatError).toBe(true)
    expect(r.canRun).toBe(false)
    expect(r.config.repeatCount).toBe(1)
  })

  it("flags a zero repeat count in count mode", () => {
    const r = derivePotionRun(potionConfig({ enabled: true, keys: KEY_Q, repeatMode: "count", repeatCount: "0" }))
    expect(r.repeatError).toBe(true)
    expect(r.config.repeatCount).toBe(1)
  })

  it("does not flag a non-numeric repeat count but falls back to MIN_REPEAT", () => {
    const r = derivePotionRun(potionConfig({ enabled: true, keys: KEY_Q, repeatMode: "count", repeatCount: "abc" }))
    expect(r.repeatError).toBe(false)
    expect(r.config.repeatCount).toBe(1)
  })

  it("clamps an oversized repeat count to MAX_REPEAT", () => {
    const r = derivePotionRun(potionConfig({ enabled: true, keys: KEY_Q, repeatMode: "count", repeatCount: "9999999" }))
    expect(r.config.repeatCount).toBe(999999)
  })

  it("ignores the repeat count in loop mode", () => {
    const r = derivePotionRun(potionConfig({ enabled: true, keys: KEY_Q, repeatMode: "loop", repeatCount: "" }))
    expect(r.repeatError).toBe(false)
    expect(r.config.repeatCount).toBe(1)
  })

  it("passes keys through to the config", () => {
    const keys = { q: false, w: true, e: false, r: true }
    const r = derivePotionRun(potionConfig({ enabled: true, keys }))
    expect(r.config.keys).toEqual(keys)
  })
})

describe("deriveSkillRun", () => {
  it("cannot run when disabled", () => {
    const r = deriveSkillRun(skillConfig({ enabled: false, steps: [{ id: "s1", type: "keydown", key: "a" }] }))
    expect(r.canRun).toBe(false)
  })

  it("cannot run without a keydown step", () => {
    const r = deriveSkillRun(
      skillConfig({
        enabled: true,
        steps: [
          { id: "s1", type: "keyup", key: "a" },
          { id: "s2", type: "delay", ms: "50" },
        ],
      }),
    )
    expect(r.canRun).toBe(false)
  })

  it("runs with one keydown step in loop mode", () => {
    const r = deriveSkillRun(skillConfig({ enabled: true, steps: [{ id: "s1", type: "keydown", key: "a" }], repeatMode: "loop" }))
    expect(r.canRun).toBe(true)
    expect(r.repeatError).toBe(false)
    expect(r.unmatchedKeydowns).toEqual(["A"])
  })

  it("omits disabled steps from playback and validation", () => {
    const r = deriveSkillRun(skillConfig({
      enabled: true,
      steps: [
        { id: "bad", type: "keydown", key: "not-a-key", disabled: true },
        { id: "down", type: "keydown", key: "A" },
        { id: "delay", type: "delay", ms: "100", disabled: true },
        { id: "up", type: "keyup", key: "A" },
      ],
    }))
    expect(r.keyError).toBe(false)
    expect(r.canRun).toBe(true)
    expect(r.unmatchedKeydowns).toEqual([])
    expect(r.config.steps).toEqual([
      { type: "keydown", key: "A" },
      { type: "keyup", key: "A" },
    ])
  })

  it("cannot run when every keydown is disabled", () => {
    const r = deriveSkillRun(skillConfig({
      enabled: true,
      steps: [{ id: "down", type: "keydown", key: "A", disabled: true }],
    }))
    expect(r.canRun).toBe(false)
    expect(r.config.steps).toEqual([])
  })

  it("blocks empty or unsupported keys but only warns for an unmatched keydown", () => {
    const invalid = deriveSkillRun(skillConfig({
      enabled: true,
      steps: [{ id: "s1", type: "keydown", key: "not-a-key" }],
    }))
    expect(invalid.keyError).toBe(true)
    expect(invalid.canRun).toBe(false)

    const held = deriveSkillRun(skillConfig({
      enabled: true,
      steps: [{ id: "s1", type: "keydown", key: "Space" }],
    }))
    expect(held.keyError).toBe(false)
    expect(held.unmatchedKeydowns).toEqual(["Space"])
    expect(held.canRun).toBe(true)
  })

  it("flags an empty repeat count in count mode", () => {
    const r = deriveSkillRun(skillConfig({ enabled: true, steps: [{ id: "s1", type: "keydown", key: "a" }], repeatMode: "count", repeatCount: "" }))
    expect(r.repeatError).toBe(true)
    expect(r.canRun).toBe(false)
  })

  it("clamps negative delay steps to 0", () => {
    const r = deriveSkillRun(skillConfig({ enabled: true, steps: [{ id: "s1", type: "delay", ms: "-5" }], repeatMode: "loop" }))
    expect(r.config.steps).toEqual([{ type: "delay", ms: 0 }])
  })

  it("scales runtime delays without changing source steps", () => {
    const steps = [{ id: "s1", type: "delay" as const, ms: "101" }]
    const r = deriveSkillRun(skillConfig({ enabled: true, playbackSpeed: "2", steps }))
    expect(r.config.steps).toEqual([{ type: "delay", ms: 51 }])
    expect(steps[0].ms).toBe("101")
  })

  it("clamps playback speed between 0.1x and 4x", () => {
    const fast = deriveSkillRun(skillConfig({ playbackSpeed: "99", steps: [{ id: "s1", type: "delay", ms: "100" }] }))
    const slow = deriveSkillRun(skillConfig({ playbackSpeed: "0", steps: [{ id: "s1", type: "delay", ms: "100" }] }))
    expect(fast.config.steps).toEqual([{ type: "delay", ms: 25 }])
    expect(slow.config.steps).toEqual([{ type: "delay", ms: 1000 }])
  })

  it("treats non-numeric delay steps as 0", () => {
    const r = deriveSkillRun(skillConfig({ enabled: true, steps: [{ id: "s1", type: "delay", ms: "abc" }], repeatMode: "loop" }))
    expect(r.config.steps).toEqual([{ type: "delay", ms: 0 }])
  })

  it("trims keydown keys", () => {
    const r = deriveSkillRun(skillConfig({ enabled: true, steps: [{ id: "s1", type: "keydown", key: " 1 " }], repeatMode: "loop" }))
    expect(r.config.steps).toEqual([{ type: "keydown", key: "1" }])
  })

  it("passes holdRightClick through", () => {
    const r = deriveSkillRun(skillConfig({ enabled: true, holdRightClick: true, steps: [{ id: "s1", type: "keydown", key: "a" }], repeatMode: "loop" }))
    expect(r.config.holdRightClick).toBe(true)
  })
})

describe("toRunnerInputs", () => {
  it("surfaces the derivations' can-run gates", () => {
    const combo: CurrentCombo = {
      potions: potionConfig({ enabled: true, keys: KEY_Q }),
      skills: skillConfig({ enabled: true, steps: [{ id: "s1", type: "keydown", key: "a" }] }),
    }
    const { potionsCanRun, skillsCanRun } = toRunnerInputs(combo)
    expect(potionsCanRun).toBe(derivePotionRun(combo.potions).canRun)
    expect(skillsCanRun).toBe(deriveSkillRun(combo.skills).canRun)
  })

  it("pins the wire shape sent to the Rust backend", () => {
    const combo: CurrentCombo = {
      potions: {
        enabled: true,
        keys: { q: true, w: false, e: false, r: false },
        customDelay: true,
        delayMs: "150",
        repeatMode: "count",
        repeatCount: "5",
      },
      skills: {
        enabled: true,
        holdRightClick: false,
        labelStyle: "abbreviation",
        repeatMode: "loop",
        repeatCount: "1",
        steps: [{ id: "x", type: "keydown", key: " 1 " }],
      },
    }
    const { potionsConfig, skillsConfig } = toRunnerInputs(combo)
    expect(JSON.stringify(potionsConfig)).toBe(
      '{"keys":{"q":true,"w":false,"e":false,"r":false},"delayMs":150,"repeatMode":"count","repeatCount":5}',
    )
    expect(JSON.stringify(skillsConfig)).toBe(
      '{"holdRightClick":false,"steps":[{"type":"keydown","key":"1"}],"repeatMode":"loop","repeatCount":1}',
    )
  })
})
