import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { invokeMock, toastMock } from "@/test/tauri-utils"
import { STORAGE_KEY } from "@/shared/persistence"
import { defaultPotionConfig, defaultSkillConfig } from "@/shared/defaults"
import type { CurrentCombo } from "@/shared/types"
import { useSettings } from "./use-settings"

beforeEach(() => {
  vi.useFakeTimers()
  invokeMock.mockResolvedValue(undefined)
})

describe("useSettings", () => {
  it("applyCombo loads the combo into both tabs' persisted state", () => {
    const { result } = renderHook(() => useSettings())
    const combo: CurrentCombo = {
      potions: { ...defaultPotionConfig(), enabled: true, customDelay: true, delayMs: "150" },
      skills: {
        ...defaultSkillConfig(),
        enabled: true,
        holdRightClick: true,
        steps: [{ id: "s1", type: "keydown", key: "1" }],
      },
    }

    act(() => result.current.applyCombo(combo))

    // `useSettings` surfaces the persisted state through buildSettings().current.
    const settings = result.current.buildSettings()
    expect(settings.current.potions).toEqual(combo.potions)
    expect(settings.current.skills).toEqual(combo.skills)
  })

  it("buildSettings snapshots the current potions, skills, and hotkeys", () => {
    const { result } = renderHook(() => useSettings())

    const settings = result.current.buildSettings()

    expect(settings).toEqual({
      version: 3,
      current: { potions: defaultPotionConfig(), skills: defaultSkillConfig() },
      hotkeys: expect.any(Array),
    })
    expect(settings.hotkeys).toHaveLength(1)
    expect(settings.hotkeys[0]).toMatchObject({ name: "Untitled", hotkey: "F5", comboPath: "" })
    expect(settings.hotkeys[0].id).toBeTruthy()
  })

  it("persists hotkeys to localStorage 300ms after they change", () => {
    const { result } = renderHook(() => useSettings())

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    act(() => result.current.addHotkey())
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()

    act(() => {
      vi.advanceTimersByTime(300)
    })

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed).toMatchObject({ version: 3 })
    expect(parsed.hotkeys).toHaveLength(2)
  })

  it("does not write when unmounted before the debounce fires", () => {
    const { result, unmount } = renderHook(() => useSettings())

    act(() => result.current.addHotkey())
    unmount()
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it("reset clears storage immediately, then repersists defaults after the debounce", () => {
    const { result } = renderHook(() => useSettings())

    act(() => result.current.addHotkey())
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).hotkeys).toHaveLength(2)

    act(() => result.current.reset())

    // clearHotkeys ran synchronously; the debounced save is still pending.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(toastMock).toHaveBeenCalledWith("Settings reset to defaults")

    act(() => {
      vi.advanceTimersByTime(300)
    })
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(parsed).toMatchObject({ version: 3 })
    expect(parsed.hotkeys).toHaveLength(1)
    expect(parsed.hotkeys[0]).toMatchObject({ name: "Untitled", hotkey: "F5", comboPath: "" })
  })
})
