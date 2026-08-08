import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { invokeMock, toastMock, fireTauriEvent } from "@/test/tauri-utils"
import { useMacroRunner } from "./use-macro-runner"
import type { RunnerInputs } from "@/runner/runner-inputs"

const POTIONS_ONLY: RunnerInputs = {
  potionsConfig: {
    keys: { q: true, w: false, e: false, r: false },
    delayMs: 2,
    repeatMode: "loop",
    repeatCount: 1,
  },
  potionsCanRun: true,
  skillsConfig: {
    holdRightClick: false,
    steps: [{ type: "keydown", key: "1" }],
    repeatMode: "loop",
    repeatCount: 1,
  },
  skillsCanRun: false,
}

const BOTH: RunnerInputs = { ...POTIONS_ONLY, skillsCanRun: true }

const NEITHER: RunnerInputs = { ...POTIONS_ONLY, potionsCanRun: false, skillsCanRun: false }

function renderRunner(props?: Partial<Parameters<typeof useMacroRunner>[0]>) {
  const onStart = vi.fn()
  const onStop = vi.fn()
  const utils = renderHook(() =>
    useMacroRunner({
      potionsCanRun: false,
      potionsConfig: POTIONS_ONLY.potionsConfig,
      skillsCanRun: false,
      skillsConfig: POTIONS_ONLY.skillsConfig,
      autoStop: { enabled: false, gameProcess: "" },
      onStart,
      onStop,
      ...props,
    }),
  )
  return { ...utils, onStart, onStop }
}

beforeEach(() => {
  invokeMock.mockResolvedValue(undefined)
})

describe("useMacroRunner", () => {
  it("warns and does not invoke when neither channel can run", () => {
    const { result, onStart } = renderRunner()
    act(() => result.current.startCombo(NEITHER))
    expect(toastMock.warning).toHaveBeenCalledWith("Enable at least one channel first")
    expect(invokeMock).not.toHaveBeenCalled()
    expect(onStart).not.toHaveBeenCalled()
  })

  it("starts the potions channel and leaves skills null", () => {
    const { result, onStart } = renderRunner()
    act(() => result.current.startCombo(POTIONS_ONLY))
    expect(invokeMock).toHaveBeenCalledWith("start_combo", {
      potions: POTIONS_ONLY.potionsConfig,
      skills: null,
      autoStop: { enabled: false, gameProcess: "" },
    })
    expect(result.current.potionsRunning).toBe(true)
    expect(result.current.skillsRunning).toBe(false)
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it("clears both channels and reports failure when start rejects", async () => {
    const { result, onStop } = renderRunner()
    invokeMock.mockRejectedValueOnce(new Error("boom"))
    await act(async () => {
      result.current.startCombo(POTIONS_ONLY)
    })
    expect(result.current.potionsRunning).toBe(false)
    expect(result.current.skillsRunning).toBe(false)
    expect(onStop).toHaveBeenCalledTimes(1)
    expect(toastMock.error).toHaveBeenCalledWith("Failed to start macro: Error: boom")
  })

  it("stopAll invokes stop_all and reports stop", () => {
    const { result, onStop } = renderRunner()
    act(() => result.current.startCombo(BOTH))
    expect(result.current.potionsRunning).toBe(true)

    act(() => result.current.stopAll())
    expect(invokeMock).toHaveBeenCalledWith("stop_all")
    expect(result.current.potionsRunning).toBe(false)
    expect(result.current.skillsRunning).toBe(false)
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it("toggleRunning stops when running and starts when stopped", () => {
    const { result } = renderRunner({ potionsCanRun: true, skillsCanRun: true })
    act(() => result.current.startCombo(BOTH))
    act(() => result.current.toggleRunning())
    expect(invokeMock).toHaveBeenCalledWith("stop_all")

    invokeMock.mockClear()
    act(() => result.current.toggleRunning())
    expect(invokeMock).toHaveBeenCalledWith("start_combo", {
      potions: POTIONS_ONLY.potionsConfig,
      skills: POTIONS_ONLY.skillsConfig,
      autoStop: { enabled: false, gameProcess: "" },
    })
  })

  it("mirrors macro-activation events into cycle counters", async () => {
    const { result } = renderRunner()
    await act(async () => {
      await fireTauriEvent("macro-activation", { channel: "potions", cycle: 42 })
      await fireTauriEvent("macro-activation", { channel: "skills", cycle: 7 })
    })
    expect(result.current.potionsCycles).toBe(42)
    expect(result.current.skillsCycles).toBe(7)
    expect(result.current.totalCycles).toBe(49)
  })

  it("macro-finished only reports stop when the other channel is already stopped", async () => {
    const { result, onStop } = renderRunner()
    act(() => result.current.startCombo(BOTH))

    // Skills finish while potions still run → no onStop.
    await act(async () => {
      await fireTauriEvent("macro-finished", { channel: "skills" })
    })
    expect(result.current.skillsRunning).toBe(false)
    expect(onStop).not.toHaveBeenCalled()

    // Stop potions, then skills-finished again → both down → onStop.
    act(() => result.current.stopAll())
    expect(onStop).toHaveBeenCalledTimes(1)

    await act(async () => {
      await fireTauriEvent("macro-finished", { channel: "skills" })
    })
    expect(onStop).toHaveBeenCalledTimes(2)
  })

  it("tracks elapsed seconds while running and resets on a new start", () => {
    vi.useFakeTimers()
    const { result } = renderRunner()
    act(() => result.current.startCombo(POTIONS_ONLY))

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.elapsed).toBe(2)

    act(() => result.current.stopAll())
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current.elapsed).toBe(2)

    act(() => result.current.startCombo(POTIONS_ONLY))
    expect(result.current.elapsed).toBe(0)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.elapsed).toBe(1)
  })

  it("forwards the autoStop config into start_combo", () => {
    const { result } = renderRunner({ autoStop: { enabled: true, gameProcess: "main.exe" } })
    act(() => result.current.startCombo(POTIONS_ONLY))
    expect(invokeMock).toHaveBeenCalledWith("start_combo", {
      potions: POTIONS_ONLY.potionsConfig,
      skills: null,
      autoStop: { enabled: true, gameProcess: "main.exe" },
    })
  })

  it("macro-auto-stopped mirrors stop, runs teardown, and toasts", async () => {
    const { result, onStop } = renderRunner()
    act(() => result.current.startCombo(BOTH))
    expect(result.current.potionsRunning).toBe(true)

    await act(async () => {
      await fireTauriEvent("macro-auto-stopped", { reason: "focus-lost" })
    })

    expect(result.current.potionsRunning).toBe(false)
    expect(result.current.skillsRunning).toBe(false)
    expect(onStop).toHaveBeenCalledTimes(1)
    expect(toastMock.info).toHaveBeenCalledWith("Stopped: game window lost focus")
  })
})
