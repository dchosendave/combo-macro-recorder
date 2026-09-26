import { useEffect } from "react"
import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window"
import { LogicalSize } from "@tauri-apps/api/dpi"

/** Compact default that stays inside the monitor work area. Input/output is logical pixels. */
export function computeFitSize(waW: number, waH: number): { width: number; height: number } {
  return { width: Math.min(860, waW), height: Math.min(620, waH) }
}

/** Apply the compact default once at launch; sizing is cosmetic and never blocks startup. */
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
