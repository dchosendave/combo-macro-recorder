import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window"
import { LogicalSize } from "@tauri-apps/api/dpi"
import { computeFitSize, useWindowFit } from "./use-window-fit"

const winStub = {
  setSize: vi.fn().mockResolvedValue(undefined),
}

describe("computeFitSize", () => {
  it("uses the compact default when it fits", () => {
    expect(computeFitSize(1920, 1080)).toEqual({ width: 860, height: 620 })
  })

  it("clamps to a smaller work area", () => {
    expect(computeFitSize(800, 600)).toEqual({ width: 800, height: 600 })
  })
})

describe("useWindowFit", () => {
  beforeEach(() => {
    vi.mocked(getCurrentWindow).mockReturnValue(winStub as never)
    vi.mocked(currentMonitor).mockResolvedValue({
      scaleFactor: 1,
      workArea: { position: { x: 0, y: 0 }, size: { width: 1920, height: 1080 } },
    } as never)
  })

  it("uses the compact size on launch", async () => {
    renderHook(() => useWindowFit())
    await act(async () => {})

    expect(winStub.setSize).toHaveBeenCalledWith(new LogicalSize(860, 620))
  })

  it("converts physical work-area pixels by the monitor scale factor", async () => {
    vi.mocked(currentMonitor).mockResolvedValue({
      scaleFactor: 1.25,
      workArea: { position: { x: 0, y: 0 }, size: { width: 1920, height: 1080 } },
    } as never)
    renderHook(() => useWindowFit())
    await act(async () => {})

    expect(winStub.setSize).toHaveBeenCalledWith(new LogicalSize(860, 620))
  })

  it("does not enlarge on larger screens", async () => {
    vi.mocked(currentMonitor).mockResolvedValue({
      scaleFactor: 1,
      workArea: { position: { x: 0, y: 0 }, size: { width: 2560, height: 1440 } },
    } as never)
    renderHook(() => useWindowFit())
    await act(async () => {})

    expect(winStub.setSize).toHaveBeenCalledWith(new LogicalSize(860, 620))
  })

  it("does not resize when no monitor is available", async () => {
    vi.mocked(currentMonitor).mockResolvedValue(null as never)
    renderHook(() => useWindowFit())
    await act(async () => {})

    expect(winStub.setSize).not.toHaveBeenCalled()
  })

  it("silently skips sizing when the monitor lookup fails", async () => {
    vi.mocked(currentMonitor).mockRejectedValue(new Error("boom"))
    renderHook(() => useWindowFit())
    await act(async () => {})

    expect(winStub.setSize).not.toHaveBeenCalled()
  })
})
