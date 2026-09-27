import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { currentMonitor, getCurrentWindow, LogicalPosition } from "@tauri-apps/api/window"
import { LogicalSize, PhysicalSize } from "@tauri-apps/api/dpi"
import { useCompactMode } from "./use-compact-mode"

const winStub = {
  innerSize: vi.fn().mockResolvedValue({ width: 1200, height: 800 }),
  outerPosition: vi.fn().mockResolvedValue({ x: 100, y: 200 }),
  setSizeConstraints: vi.fn().mockResolvedValue(undefined),
  setResizable: vi.fn().mockResolvedValue(undefined),
  setSize: vi.fn().mockResolvedValue(undefined),
  setPosition: vi.fn().mockResolvedValue(undefined),
  isAlwaysOnTop: vi.fn().mockResolvedValue(false),
  setAlwaysOnTop: vi.fn().mockResolvedValue(undefined),
}

describe("useCompactMode", () => {
  it("restores physical size when Stop arrives during entry", async () => {
    const deferred = Promise.withResolvers<{ width: number; height: number }>()
    winStub.innerSize.mockReturnValueOnce(deferred.promise)
    const { result } = renderHook(() => useCompactMode())
    let entering!: Promise<void>
    let exiting!: Promise<void>
    await act(async () => { entering = result.current.enterCompact(); exiting = result.current.exitCompact() })
    await act(async () => { deferred.resolve({ width: 1800, height: 1200 }); await entering; await exiting })
    expect(result.current.compactMode).toBe(false)
    expect(winStub.setSize).toHaveBeenLastCalledWith(new PhysicalSize(1800, 1200))
    expect(winStub.setResizable).toHaveBeenLastCalledWith(true)
  })

  it("restores constraints after partial entry failure", async () => {
    winStub.setPosition.mockRejectedValueOnce(new Error("position failed"))
    const { result } = renderHook(() => useCompactMode())
    await act(async () => { await result.current.enterCompact() })
    expect(result.current.compactMode).toBe(false)
    expect(winStub.setSizeConstraints).toHaveBeenLastCalledWith({ minWidth: 700, minHeight: 560 })
    expect(winStub.setResizable).toHaveBeenLastCalledWith(true)
  })
  beforeEach(() => {
    vi.mocked(getCurrentWindow).mockReturnValue(winStub as never)
    vi.mocked(currentMonitor).mockResolvedValue({
      scaleFactor: 1,
      workArea: { position: { x: 0, y: 0 }, size: { width: 1920, height: 1080 } },
    } as never)
  })

  it("enterCompact with auto corner parks bottom-left and resizes to the compact bar", async () => {
    const { result } = renderHook(() => useCompactMode())
    expect(result.current.compactMode).toBe(false)

    await act(async () => {
      await result.current.enterCompact()
    })

    expect(result.current.compactMode).toBe(true)
    expect(winStub.setSizeConstraints).toHaveBeenCalledWith(null)
    expect(winStub.setSize).toHaveBeenCalledWith(new LogicalSize(500, 38))
    // setResizable(false) must come after setSize (its second invocation follows the size call)
    const setSizeOrder = winStub.setSize.mock.invocationCallOrder[0]
    const setResizableFalseOrder = winStub.setResizable.mock.invocationCallOrder[1]
    expect(setResizableFalseOrder).toBeGreaterThan(setSizeOrder)
    // window center (700, 600) is left and below work-area center (960, 540) -> bottom-left corner
    expect(winStub.setPosition).toHaveBeenCalledWith(new LogicalPosition(0, 1042))
    expect(winStub.isAlwaysOnTop).toHaveBeenCalledTimes(1)
    expect(winStub.setAlwaysOnTop).toHaveBeenCalledWith(true)
  })

  it("exitCompact restores saved position, size, resizable and min constraints", async () => {
    const { result } = renderHook(() => useCompactMode())
    await act(async () => {
      await result.current.enterCompact()
    })
    expect(result.current.compactMode).toBe(true)

    await act(async () => {
      await result.current.exitCompact()
    })

    expect(result.current.compactMode).toBe(false)
    expect(winStub.setPosition).toHaveBeenLastCalledWith({ x: 100, y: 200 })
    // the hook stores `new LogicalSize(current)`, a copy of the resolved innerSize —
    // compare fields (deep), not identity
    const current = { width: 1200, height: 800 }
    expect(winStub.setSize).toHaveBeenLastCalledWith(new PhysicalSize(current.width, current.height))
    expect(winStub.setResizable).toHaveBeenLastCalledWith(true)
    expect(winStub.setSizeConstraints).toHaveBeenLastCalledWith({ minWidth: 700, minHeight: 560 })
    expect(winStub.setAlwaysOnTop).toHaveBeenCalledWith(false)
  })

  it("compact mode restores a prior always-on-top state", async () => {
    vi.mocked(winStub.isAlwaysOnTop).mockResolvedValue(true)
    const { result } = renderHook(() => useCompactMode())

    await act(async () => {
      await result.current.enterCompact()
    })
    expect(winStub.setAlwaysOnTop).toHaveBeenCalledWith(true)

    await act(async () => {
      await result.current.exitCompact()
    })

    expect(result.current.compactMode).toBe(false)
    // prior state was on-top -> restored to on-top
    expect(winStub.setAlwaysOnTop).toHaveBeenLastCalledWith(true)
  })

  it("setCompactCorner persists to localStorage", () => {
    const { result } = renderHook(() => useCompactMode())

    act(() => {
      result.current.setCompactCorner("top-right")
    })

    expect(result.current.compactCorner).toBe("top-right")
    expect(localStorage.getItem("combo-macro-compact-corner")).toBe("top-right")
  })

  it("initial compactCorner defaults to auto when no stored corner exists", () => {
    expect(localStorage.getItem("combo-macro-compact-corner")).toBeNull()
    const { result } = renderHook(() => useCompactMode())
    expect(result.current.compactCorner).toBe("auto")
  })

  it("reads a previously stored corner from localStorage on mount", () => {
    localStorage.setItem("combo-macro-compact-corner", "bottom-left")
    const { result } = renderHook(() => useCompactMode())
    expect(result.current.compactCorner).toBe("bottom-left")
  })

  it("enterCompact is a no-op when already compact", async () => {
    const { result } = renderHook(() => useCompactMode())
    await act(async () => {
      await result.current.enterCompact()
    })
    expect(result.current.compactMode).toBe(true)

    vi.clearAllMocks()

    await act(async () => {
      await result.current.enterCompact()
    })

    expect(winStub.innerSize).not.toHaveBeenCalled()
    expect(winStub.outerPosition).not.toHaveBeenCalled()
    expect(winStub.setSizeConstraints).not.toHaveBeenCalled()
    expect(winStub.setResizable).not.toHaveBeenCalled()
    expect(winStub.setSize).not.toHaveBeenCalled()
    expect(winStub.setPosition).not.toHaveBeenCalled()
    expect(winStub.isAlwaysOnTop).not.toHaveBeenCalled()
    expect(winStub.setAlwaysOnTop).not.toHaveBeenCalled()
    expect(vi.mocked(getCurrentWindow)).not.toHaveBeenCalled()
  })
})
