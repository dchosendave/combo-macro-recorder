import { useEffect } from "react"
import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window"
import { LogicalSize } from "@tauri-apps/api/dpi"

/** Largest-fit 16:9 default: 2/3 of work-area width, capped at 85% of work-area height, floored to the smallest 16:9 rect that clears the 660x720 min constraints (1280x720), never overflowing the work area. Input/output in logical pixels. */
export function computeFitSize(waW: number, waH: number): { width: number; height: number } {
  let width = Math.round((waW * 2) / 3)
  let height = Math.round((width * 9) / 16)
  // The 0.85 height cap only bites on wide/ultrawide screens (e.g. 3440x1440
  // -> 2176x1224 instead of 2293x1290), keeping vertical margins.
  if (height > Math.round(waH * 0.85)) {
    height = Math.round(waH * 0.85)
    width = Math.round((height * 16) / 9)
  }
  // Floor: the smallest 16:9 rect that clears the 660x720 min constraints is
  // 1280x720 — handles small screens and Windows display scaling (e.g. a
  // 1366x768 work area or a 125%-scaled 1080p -> exactly 1280x720).
  width = Math.max(width, 1280)
  height = Math.max(height, 720)
  // Never overflow the work area (only reachable on sub-1280-wide or
  // sub-720-tall screens like 1024x768 -> 1024x720, where fit wins over aspect).
  width = Math.min(width, waW)
  height = Math.min(height, waH)
  return { width, height }
}

/** On launch, resize the window to a 16:9 rectangle ~2/3 the width of the current monitor's work area. One-shot; cosmetic — never fail startup over sizing. */
export function useWindowFit() {
  useEffect(() => {
    ;(async () => {
      try {
        const monitor = await currentMonitor()
        if (!monitor) return
        const scale = monitor.scaleFactor
        const wa = monitor.workArea
        const target = computeFitSize(wa.size.width / scale, wa.size.height / scale)
        await getCurrentWindow().setSize(new LogicalSize(target.width, target.height))
      } catch {
        // sizing is cosmetic — never block startup on failure
      }
    })()
  }, [])
}
