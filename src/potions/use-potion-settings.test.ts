import { describe, it, expect } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { MIN_DELAY, defaultPotionConfig } from "@/shared/defaults"
import { usePotionSettings } from "./use-potion-settings"
import type { PotionConfig } from "@/shared/types"

describe("usePotionSettings", () => {
  it("initializes state from defaultPotionConfig", () => {
    const { result } = renderHook(() => usePotionSettings(defaultPotionConfig()))
    expect(result.current.persisted).toEqual(defaultPotionConfig())
    expect(result.current.potionsEnabled).toBe(false)
    expect(result.current.delayMs).toBe(String(MIN_DELAY))
  })

  it("togglePotionKey flips the key", () => {
    const { result } = renderHook(() => usePotionSettings(defaultPotionConfig()))
    expect(result.current.potionKeys.q).toBe(true)
    act(() => result.current.togglePotionKey("q"))
    expect(result.current.potionKeys.q).toBe(false)
    act(() => result.current.togglePotionKey("q"))
    expect(result.current.potionKeys.q).toBe(true)
  })

  it("setCustomDelayEnabled(false) resets delayMs to MIN_DELAY", () => {
    const initial: PotionConfig = {
      ...defaultPotionConfig(),
      customDelay: true,
      delayMs: "150",
    }
    const { result } = renderHook(() => usePotionSettings(initial))
    act(() => result.current.setCustomDelayEnabled(false))
    expect(result.current.customDelay).toBe(false)
    expect(result.current.delayMs).toBe(String(MIN_DELAY))
  })

  it("apply replaces every field", () => {
    const { result } = renderHook(() => usePotionSettings(defaultPotionConfig()))
    const config: PotionConfig = {
      enabled: true,
      keys: { q: false, w: true, e: false, r: true },
      customDelay: true,
      delayMs: "250",
      repeatMode: "count",
      repeatCount: "3",
    }
    act(() => result.current.apply(config))
    expect(result.current.persisted).toEqual(config)
    expect(result.current.potionsEnabled).toBe(true)
    expect(result.current.potionKeys).toEqual(config.keys)
    expect(result.current.potionsRepeatCount).toBe("3")
  })

  it("surfaces the derivation instead of re-deriving", () => {
    const { result } = renderHook(() => usePotionSettings(defaultPotionConfig()))
    act(() => {
      result.current.setPotionsEnabled(true)
      result.current.setCustomDelayEnabled(true)
      result.current.setDelayMs("1")
    })
    // delayMs state stays the raw string; the derivation config carries a number
    expect(result.current.delayMs).toBe("1")
    expect(result.current.potionsDelayError).toBe(true)
    expect(result.current.potionsCanRun).toBe(false)
    expect(result.current.potionsConfig.delayMs).toBe(MIN_DELAY)
    expect(typeof result.current.potionsConfig.delayMs).toBe("number")

    act(() => result.current.setPotionsEnabled(false))
    expect(result.current.potionsCanRun).toBe(false)
  })
})
