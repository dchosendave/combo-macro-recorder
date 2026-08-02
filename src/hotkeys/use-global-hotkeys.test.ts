import { describe, it, expect, vi, beforeEach } from "vitest"
import type { MutableRefObject } from "react"
import { act, renderHook } from "@testing-library/react"
import { invokeMock, toastMock, fireTauriEvent } from "@/test/tauri-utils"
import { useGlobalHotkeys } from "./use-global-hotkeys"
import { codeToShortcut } from "@/shared/keycodes"
import { exportComboToString } from "@/combo-file/combo-io"
import { toRunnerInputs } from "@/runner/runner-inputs"
import type { CurrentCombo, HotkeyBinding } from "@/shared/types"

const COMBO_PATH = "C:\\combos\\a.json"

const PROFILE_P1: HotkeyBinding = { id: "p1", name: "P1", hotkey: "Control+F5", comboPath: COMBO_PATH }
const PROFILE_P2: HotkeyBinding = { id: "p2", name: "P2", hotkey: "F6", comboPath: "" }

function combo(potionKey: string): CurrentCombo {
  return {
    potions: {
      enabled: true,
      keys: { q: potionKey === "q", w: false, e: false, r: false },
      customDelay: false,
      delayMs: "2",
      repeatMode: "loop",
      repeatCount: "1",
    },
    skills: {
      enabled: false,
      holdRightClick: false,
      steps: [],
      labelStyle: "abbreviation",
      repeatMode: "loop",
      repeatCount: "1",
    },
  }
}

const COMBO_1 = combo("q")
const COMBO_2 = combo("w")

type Deferred = { resolve: (value: string) => void; promise: Promise<string> }

function deferredReads(): { reads: Deferred[]; mock: (cmd: string) => Promise<unknown> } {
  const reads: Deferred[] = []
  const mock = (cmd: string): Promise<unknown> => {
    if (cmd === "read_file") {
      let resolve!: (value: string) => void
      const promise = new Promise<string>((res) => {
        resolve = res
      })
      reads.push({ resolve, promise })
      return promise
    }
    return Promise.resolve(undefined)
  }
  return { reads, mock }
}

function renderHotkeys(initial?: Partial<Parameters<typeof useGlobalHotkeys>[0]>) {
  const ref: MutableRefObject<string | null> = { current: null }
  const spies = {
    toggleRunning: vi.fn(),
    startCombo: vi.fn(),
    stopAll: vi.fn(),
    applyCombo: vi.fn(),
  }
  // Mutate `props` between `rerender()` calls to simulate prop changes (the
  // render callback captures this object).
  const props = {
    hotkeys: [PROFILE_P1, PROFILE_P2],
    ...spies,
    runningProfileIdRef: ref,
    ...initial,
  }
  const utils = renderHook(() => useGlobalHotkeys(props))
  return { ...utils, ...spies, ref, props }
}

beforeEach(() => {
  invokeMock.mockResolvedValue(undefined)
})

describe("useGlobalHotkeys", () => {
  const setHotkeysCalls = () =>
    invokeMock.mock.calls.filter(([cmd]) => cmd === "set_hotkeys")

  it("registers shortcuts (debounced) with codeToShortcut applied", () => {
    vi.useFakeTimers()
    const { rerender, props } = renderHotkeys()
    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(setHotkeysCalls()).toHaveLength(1)
    expect(invokeMock).toHaveBeenCalledWith("set_hotkeys", {
      hotkeys: [
        { shortcut: codeToShortcut("Control+F5"), hotkeyId: "p1" },
        { shortcut: codeToShortcut("F6"), hotkeyId: "p2" },
      ],
    })

    // Rapid re-render with changed hotkeys → still exactly one registration
    // (the previous debounce timer was cleared).
    invokeMock.mockClear()
    props.hotkeys = [PROFILE_P2]
    rerender()
    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(setHotkeysCalls()).toHaveLength(1)
    expect(invokeMock).toHaveBeenCalledWith("set_hotkeys", {
      hotkeys: [{ shortcut: "F6", hotkeyId: "p2" }],
    })
  })

  it("warns when set_hotkeys rejects", async () => {
    vi.useFakeTimers()
    renderHotkeys()
    invokeMock.mockImplementation((cmd) =>
      cmd === "set_hotkeys" ? Promise.reject(new Error("denied")) : Promise.resolve(undefined),
    )
    await act(async () => {
      vi.advanceTimersByTime(50)
    })
    expect(toastMock.warning).toHaveBeenCalledWith("Failed to register global hotkeys")
  })

  it("preloads combo files on mount and caches the parsed content", async () => {
    invokeMock.mockImplementation((cmd) =>
      cmd === "read_file" ? Promise.resolve(exportComboToString(COMBO_1)) : Promise.resolve(undefined),
    )
    renderHotkeys()
    await act(async () => {})
    expect(invokeMock).toHaveBeenCalledWith("read_file", { path: COMBO_PATH })
  })

  it("toggles the live combo for profiles without a combo path", async () => {
    const { toggleRunning } = renderHotkeys()
    invokeMock.mockClear()
    await act(async () => {
      await fireTauriEvent("macro-toggle", "p2")
    })
    expect(toggleRunning).toHaveBeenCalledTimes(1)
    expect(invokeMock).not.toHaveBeenCalledWith("read_file", expect.anything())
  })

  it("loads, applies, and starts the combo for a path profile", async () => {
    const { applyCombo, startCombo, ref } = renderHotkeys()
    invokeMock.mockImplementation((cmd) =>
      cmd === "read_file" ? Promise.resolve(exportComboToString(COMBO_1)) : Promise.resolve(undefined),
    )
    await act(async () => {})
    await act(async () => {
      await fireTauriEvent("macro-toggle", "p1")
    })
    expect(applyCombo).toHaveBeenCalledWith(COMBO_1)
    expect(ref.current).toBe("p1")
    expect(startCombo).toHaveBeenCalledWith(toRunnerInputs(COMBO_1))
  })

  it("stops the running profile instead of re-loading it", async () => {
    const { stopAll, ref } = renderHotkeys()
    invokeMock.mockImplementation((cmd) =>
      cmd === "read_file" ? Promise.resolve(exportComboToString(COMBO_1)) : Promise.resolve(undefined),
    )
    await act(async () => {})
    ref.current = "p1"
    invokeMock.mockClear()

    await act(async () => {
      await fireTauriEvent("macro-toggle", "p1")
    })
    expect(stopAll).toHaveBeenCalledTimes(1)
    expect(ref.current).toBeNull()
    expect(invokeMock).not.toHaveBeenCalledWith("read_file", expect.anything())
  })

  it("last press wins when loads race", async () => {
    const { reads, mock } = deferredReads()
    invokeMock.mockImplementation(mock)

    const { applyCombo, startCombo } = renderHotkeys()
    await act(async () => {})
    // The mount preload consumed the first read.
    expect(reads.length).toBe(1)

    // Press 1 starts a slow load; press 2 (fast load) supersedes it.
    const press1 = fireTauriEvent("macro-toggle", "p1")
    expect(reads.length).toBe(2)
    const press2 = fireTauriEvent("macro-toggle", "p1")
    expect(reads.length).toBe(3)

    await act(async () => {
      reads[2].resolve(exportComboToString(COMBO_2))
      await press2
    })
    expect(startCombo).toHaveBeenCalledTimes(1)
    expect(startCombo).toHaveBeenCalledWith(toRunnerInputs(COMBO_2))
    expect(applyCombo).toHaveBeenCalledTimes(1)

    // The stale press-1 load resolves later and must be discarded.
    await act(async () => {
      reads[1].resolve(exportComboToString(COMBO_1))
      await press1
    })
    expect(startCombo).toHaveBeenCalledTimes(1)
    expect(applyCombo).toHaveBeenCalledTimes(1)

    await act(async () => {
      reads[0].resolve(exportComboToString(COMBO_1))
    })
  })

  it("serves subsequent presses from the cache without re-reading", async () => {
    invokeMock.mockImplementation((cmd) =>
      cmd === "read_file" ? Promise.resolve(exportComboToString(COMBO_1)) : Promise.resolve(undefined),
    )
    const { applyCombo, startCombo } = renderHotkeys()
    await act(async () => {})
    invokeMock.mockClear()

    await act(async () => {
      await fireTauriEvent("macro-toggle", "p1")
    })
    expect(invokeMock).not.toHaveBeenCalledWith("read_file", expect.anything())
    expect(applyCombo).toHaveBeenCalledWith(COMBO_1)
    expect(startCombo).toHaveBeenCalledTimes(1)
  })

  it("clearCachedCombo forces the next press to re-read", async () => {
    invokeMock.mockImplementation((cmd) =>
      cmd === "read_file" ? Promise.resolve(exportComboToString(COMBO_1)) : Promise.resolve(undefined),
    )
    const { result, applyCombo, ref } = renderHotkeys()
    await act(async () => {})
    await act(async () => {
      await fireTauriEvent("macro-toggle", "p1")
    })

    // Press 1 marked the profile running; reset so the next press loads again.
    ref.current = null
    invokeMock.mockClear()
    act(() => result.current.clearCachedCombo(COMBO_PATH))
    await act(async () => {
      await fireTauriEvent("macro-toggle", "p1")
    })
    expect(invokeMock).toHaveBeenCalledWith("read_file", { path: COMBO_PATH })
    expect(applyCombo).toHaveBeenCalledTimes(2)
  })

  it("reports a load failure with the profile name", async () => {
    renderHotkeys()
    invokeMock.mockImplementation((cmd) =>
      cmd === "read_file" ? Promise.reject(new Error("missing")) : Promise.resolve(undefined),
    )
    await act(async () => {})
    await act(async () => {
      await fireTauriEvent("macro-toggle", "p1")
    })
    expect(toastMock.error).toHaveBeenCalledWith("Failed to load P1")
  })
})
