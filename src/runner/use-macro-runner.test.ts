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
const RUNNING_BOTH = { sessionId: 1, potionsRunning: true, skillsRunning: true }
const RUNNING_POTIONS = { sessionId: 1, potionsRunning: true, skillsRunning: false }
const STOPPED = { sessionId: 0, potionsRunning: false, skillsRunning: false }

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
  invokeMock.mockClear()
  return { ...utils, onStart, onStop }
}

beforeEach(() => {
  invokeMock.mockImplementation(async (command) => {
    if (command === "start_combo") return RUNNING_POTIONS
    return STOPPED
  })
})

describe("useMacroRunner", () => {
  it("warns and does not invoke when neither channel can run", async () => {
    const { result, onStart } = renderRunner()
    await act(async () => { await result.current.startCombo(NEITHER) })
    expect(toastMock.warning).toHaveBeenCalledWith("Enable at least one channel first")
    expect(invokeMock).not.toHaveBeenCalled()
    expect(onStart).not.toHaveBeenCalled()
  })

  it("starts the potions channel after backend confirmation and leaves skills null", async () => {
    const { result, onStart } = renderRunner()
    await act(async () => { await result.current.startCombo(POTIONS_ONLY) })
    expect(invokeMock).toHaveBeenCalledWith("start_combo", {
      potions: POTIONS_ONLY.potionsConfig,
      skills: null,
      autoStop: { enabled: false, gameProcess: "" },
    })
    expect(result.current.potionsRunning).toBe(true)
    expect(result.current.skillsRunning).toBe(false)
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(result.current.sessionId).toBe(1)
  })

  it("does not report running until the backend confirms startup", async () => {
    let confirm!: (status: typeof RUNNING_POTIONS) => void
    const { result, onStart } = renderRunner()
    invokeMock.mockReturnValueOnce(new Promise((resolve) => { confirm = resolve }))

    let startPromise!: Promise<boolean>
    act(() => { startPromise = result.current.startCombo(POTIONS_ONLY) })
    expect(result.current.potionsRunning).toBe(false)
    expect(result.current.commandPending).toBe(true)
    expect(onStart).not.toHaveBeenCalled()

    await act(async () => {
      confirm(RUNNING_POTIONS)
      await startPromise
    })
    expect(result.current.potionsRunning).toBe(true)
    expect(result.current.commandPending).toBe(false)
  })

  it("clears both channels and reports failure when start rejects", async () => {
    const { result, onStop } = renderRunner()
    invokeMock.mockRejectedValueOnce(new Error("boom"))
    await act(async () => {
      await result.current.startCombo(POTIONS_ONLY)
    })
    expect(result.current.potionsRunning).toBe(false)
    expect(result.current.skillsRunning).toBe(false)
    expect(onStop).toHaveBeenCalledTimes(1)
    expect(toastMock.error).toHaveBeenCalledWith("Failed to start macro: Error: boom")
  })

  it("stopAll invokes stop_all and reports stop", async () => {
    const { result, onStop } = renderRunner()
    invokeMock.mockResolvedValueOnce(RUNNING_BOTH)
    await act(async () => { await result.current.startCombo(BOTH) })
    expect(result.current.potionsRunning).toBe(true)

    await act(async () => { await result.current.stopAll() })
    expect(invokeMock).toHaveBeenCalledWith("stop_all")
    expect(result.current.potionsRunning).toBe(false)
    expect(result.current.skillsRunning).toBe(false)
    expect(onStop).toHaveBeenCalledTimes(1)
    expect(result.current.lastStopReason).toBe("manual")
  })

  it("records an explicit emergency stop reason", async () => {
    const { result } = renderRunner()
    await act(async () => { await result.current.stopAll("emergency") })
    expect(result.current.lastStopReason).toBe("emergency")
  })

  it("toggleRunning stops when running and starts when stopped", async () => {
    const { result } = renderRunner({ potionsCanRun: true, skillsCanRun: true })
    invokeMock.mockResolvedValueOnce(RUNNING_BOTH)
    await act(async () => { await result.current.startCombo(BOTH) })
    await act(async () => { await result.current.toggleRunning() })
    expect(invokeMock).toHaveBeenCalledWith("stop_all")

    invokeMock.mockClear()
    invokeMock.mockResolvedValueOnce(RUNNING_BOTH)
    await act(async () => { await result.current.toggleRunning() })
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

  it("shows step progress only for the active skills session", async () => {
    const { result } = renderRunner()
    invokeMock.mockResolvedValueOnce(RUNNING_BOTH)
    await act(async () => { await result.current.startCombo(BOTH) })

    await act(async () => {
      await fireTauriEvent("macro-step", { sessionId: 1, stepIndex: 3 })
    })
    expect(result.current.activeSkillStepIndex).toBe(3)

    await act(async () => {
      await fireTauriEvent("macro-step", { sessionId: 99, stepIndex: 8 })
    })
    expect(result.current.activeSkillStepIndex).toBeNull()
  })

  it("macro-finished only reports stop when the other channel is already stopped", async () => {
    const { result, onStop } = renderRunner()
    invokeMock.mockResolvedValueOnce(RUNNING_BOTH)
    await act(async () => { await result.current.startCombo(BOTH) })

    // Skills finish while potions still run → no onStop.
    await act(async () => {
      await fireTauriEvent("macro-finished", { channel: "skills", reason: "repeat-complete" })
    })
    expect(result.current.skillsRunning).toBe(false)
    expect(result.current.lastStopReason).toBe("repeat-complete")
    expect(onStop).not.toHaveBeenCalled()

    // Stop potions, then skills-finished again → both down → onStop.
    await act(async () => { await result.current.stopAll() })
    expect(onStop).toHaveBeenCalledTimes(1)

    await act(async () => {
      await fireTauriEvent("macro-finished", { channel: "skills" })
    })
    expect(onStop).toHaveBeenCalledTimes(2)
  })

  it("records focus loss and startup failure outcomes", async () => {
    const { result } = renderRunner()
    await act(async () => {
      await fireTauriEvent("macro-auto-stopped", { reason: "focus-lost" })
    })
    expect(result.current.lastStopReason).toBe("focus-lost")

    invokeMock.mockRejectedValueOnce(new Error("boom"))
    await act(async () => { await result.current.startCombo(POTIONS_ONLY) })
    expect(result.current.lastStopReason).toBe("startup-failure")
  })

  it("tracks elapsed seconds while running and resets on a new start", async () => {
    vi.useFakeTimers()
    const { result } = renderRunner()
    await act(async () => { await result.current.startCombo(POTIONS_ONLY) })

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.elapsed).toBe(2)

    await act(async () => { await result.current.stopAll() })
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current.elapsed).toBe(2)

    await act(async () => { await result.current.startCombo(POTIONS_ONLY) })
    expect(result.current.elapsed).toBe(0)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.elapsed).toBe(1)
  })

  it("forwards the autoStop config into start_combo", async () => {
    const { result } = renderRunner({ autoStop: { enabled: true, gameProcess: "main.exe" } })
    await act(async () => { await result.current.startCombo(POTIONS_ONLY) })
    expect(invokeMock).toHaveBeenCalledWith("start_combo", {
      potions: POTIONS_ONLY.potionsConfig,
      skills: null,
      autoStop: { enabled: true, gameProcess: "main.exe" },
    })
  })

  it("macro-auto-stopped mirrors stop, runs teardown, and toasts", async () => {
    const { result, onStop } = renderRunner()
    invokeMock.mockResolvedValueOnce(RUNNING_BOTH)
    await act(async () => { await result.current.startCombo(BOTH) })
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
