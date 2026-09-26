import { useCallback, useRef, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { currentMonitor, getCurrentWindow, LogicalPosition } from "@tauri-apps/api/window"
import { LogicalSize, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi"
import { toast } from "sonner"
import type { CompactCorner } from "@/shared/types"

const COMPACT = new LogicalSize(500, 38)
const MIN_CONSTRAINTS = { minWidth: 700, minHeight: 560 }
const CORNER_KEY = "combo-macro-compact-corner"
const MARGIN = 0

/** Collapses the window to a 500x38 overlay (outer size — ~30px client area) parked in a screen corner while a combo runs, restoring size/position/min-size constraints on exit. `auto` corner picks the corner matching the window center relative to the work area. */
export function useCompactMode() {
  const [compactMode, setCompactMode] = useState(false)
  const [compactCorner, setCompactCornerState] = useState<CompactCorner>(() => {
    return (localStorage.getItem(CORNER_KEY) as CompactCorner) || "auto"
  })

  const compactModeRef = useRef(compactMode)

  const compactCornerRef = useRef(compactCorner)
  compactCornerRef.current = compactCorner

  const savedPositionRef = useRef<PhysicalPosition | null>(null)
  const savedPhysSizeRef = useRef<PhysicalSize | null>(null)
  const previousAlwaysOnTopRef = useRef(false)
  const queueRef = useRef<Promise<void>>(Promise.resolve())
  const enqueue = useCallback((operation: () => Promise<void>) => {
    const result = queueRef.current.then(operation, operation)
    queueRef.current = result.catch(() => {})
    return result
  }, [])
  const restore = useCallback(async () => {
    const size = savedPhysSizeRef.current
    if (!size) return
    const win = getCurrentWindow()
    let failure: unknown
    for (const operation of [
      () => win.setResizable(true),
      () => win.setSize(size),
      () => savedPositionRef.current ? win.setPosition(savedPositionRef.current) : Promise.resolve(),
      () => win.setSizeConstraints(MIN_CONSTRAINTS),
      () => win.setAlwaysOnTop(previousAlwaysOnTopRef.current),
    ]) {
      try { await operation() } catch (error) { failure ??= error }
    }
    await invoke("set_hard_corners", { enabled: false }).catch(() => {})
    compactModeRef.current = false
    setCompactMode(false)
    if (failure) throw failure
    savedPhysSizeRef.current = null
  }, [])

  const setCompactCorner = useCallback((corner: CompactCorner) => {
    setCompactCornerState(corner)
    localStorage.setItem(CORNER_KEY, corner)
  }, [])

  const enterCompact = useCallback(() => enqueue(async () => {
    if (compactModeRef.current) return
    try {
      const win = getCurrentWindow()
      const current = await win.innerSize()
      savedPositionRef.current = await win.outerPosition()
      previousAlwaysOnTopRef.current = await win.isAlwaysOnTop()
      savedPhysSizeRef.current = new PhysicalSize(current.width, current.height)

      await win.setSizeConstraints(null)
      await win.setResizable(true)
      await win.setSize(COMPACT)
      await win.setResizable(false)

      await win.setAlwaysOnTop(true)

      const monitor = await currentMonitor()
      if (monitor) {
        const scale = monitor.scaleFactor
        const wa = monitor.workArea
        const waLeft = wa.position.x / scale
        const waTop = wa.position.y / scale
        const waWidth = wa.size.width / scale
        const waHeight = wa.size.height / scale
        const ww = COMPACT.width
        const wh = COMPACT.height

        let corner = compactCornerRef.current

        if (corner === "auto") {
          const sp = savedPositionRef.current
          const ss = savedPhysSizeRef.current
          if (sp && ss) {
            const winCenterX = (sp.x + ss.width / 2) / scale
            const winCenterY = (sp.y + ss.height / 2) / scale
            const waCenterX = waLeft + waWidth / 2
            const waCenterY = waTop + waHeight / 2
            const isRight = winCenterX > waCenterX
            const isBottom = winCenterY > waCenterY
            corner = isRight
              ? isBottom ? "bottom-right" : "top-right"
              : isBottom ? "bottom-left" : "top-left"
          } else {
            corner = "top-right"
          }
        }

        let x: number
        let y: number
        switch (corner) {
          case "top-right":
            x = waLeft + waWidth - ww - MARGIN
            y = waTop + MARGIN
            break
          case "top-left":
            x = waLeft + MARGIN
            y = waTop + MARGIN
            break
          case "bottom-right":
            x = waLeft + waWidth - ww - MARGIN
            y = waTop + waHeight - wh - MARGIN
            break
          case "bottom-left":
            x = waLeft + MARGIN
            y = waTop + waHeight - wh - MARGIN
            break
          default:
            x = waLeft + waWidth - ww - MARGIN
            y = waTop + MARGIN
        }

        await win.setPosition(new LogicalPosition(x, y))
      }

      // Square corners for the bar (Win11 DWM rounds undecorated windows by
      // default). Cosmetic — never fail compact mode over it.
      invoke("set_hard_corners", { enabled: true }).catch(() => {})

      compactModeRef.current = true
      setCompactMode(true)
    } catch (e) {
      toast.error(`Compact mode failed: ${e}`)
      try { await restore() } catch (error) { toast.error(`Restore mode failed: ${error}`) }
    }
  }), [enqueue, restore])

  const exitCompact = useCallback(() => enqueue(async () => {
    try {
      await restore()
    } catch (e) {
      toast.error(`Restore mode failed: ${e}`)
    }
  }), [enqueue, restore])

  return { compactMode, compactCorner, setCompactCorner, enterCompact, exitCompact }
}
