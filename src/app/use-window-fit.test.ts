import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window"
import { LogicalSize } from "@tauri-apps/api/dpi"
import { computeFitSize, useWindowFit } from "./use-window-fit"

const winStub = {
  setSize: vi.fn().mockResolvedValue(undefined),
}

describe("computeFitSize", () => {
  it("sizes a 1080p work area to 2/3 width at 16:9", () => {
    expect(computeFitSize(1920, 1080)).toEqual({ width: 1280, height: 720 })
  })

  it("scales up proportionally on a 1440p work area", () => {
    expect(computeFitSize(2560, 1440)).toEqual({ width: 1707, height: 960 })
  })

  it("caps the height on ultrawide work areas", () => {
    expect(computeFitSize(3440, 1440)).toEqual({ width: 2176, height: 1224 })
  })

  it("floors to the smallest 16:9 rect on small work areas", () => {
    expect(computeFitSize(1366, 728)).toEqual({ width: 1280, height: 720 })
  })

  it("floors to 1280x720 on a 125%-scaled 1080p work area", () => {
    expect(computeFitSize(1536, 864)).toEqual({ width: 1280, height: 720 })
  })

  it("clamps the width to the work area when 16:9 cannot fit", () => {
    expect(computeFitSize(1024, 768)).toEqual({ width: 1024, height: 720 })
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

  it("sizes the window to 2/3 of the work-area width at 16:9 on launch", async () => {
    renderHook(() => useWindowFit())
    await act(async () => {})

    expect(winStub.setSize).toHaveBeenCalledWith(new LogicalSize(1280, 720))
  })

  it("converts physical work-area pixels by the monitor scale factor", async () => {
    vi.mocked(currentMonitor).mockResolvedValue({
      scaleFactor: 1.25,
      workArea: { position: { x: 0, y: 0 }, size: { width: 1920, height: 1080 } },
    } as never)
    renderHook(() => useWindowFit())
    await act(async () => {})

    expect(winStub.setSize).toHaveBeenCalledWith(new LogicalSize(1280, 720))
  })

  it("scales up proportionally on larger screens", async () => {
    vi.mocked(currentMonitor).mockResolvedValue({
      scaleFactor: 1,
      workArea: { position: { x: 0, y: 0 }, size: { width: 2560, height: 1440 } },
    } as never)
    renderHook(() => useWindowFit())
    await act(async () => {})

    expect(winStub.setSize).toHaveBeenCalledWith(new LogicalSize(1707, 960))
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
