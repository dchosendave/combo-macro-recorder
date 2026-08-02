import { useCallback, useRef, useState } from "react"
import { currentMonitor, getCurrentWindow, LogicalPosition } from "@tauri-apps/api/window"
import { LogicalSize, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi"
import { toast } from "sonner"
import type { CompactCorner } from "@/shared/types"

const COMPACT = new LogicalSize(500, 68)
const MIN_CONSTRAINTS = { minWidth: 660, minHeight: 720 }
const CORNER_KEY = "combo-macro-compact-corner"
const MARGIN = 0

/** Collapses the window to a 500x68 overlay parked in a screen corner while a combo runs, restoring size/position/min-size constraints on exit. `auto` corner picks the corner matching the window center relative to the work area. */
export function useCompactMode() {
  const [compactMode, setCompactMode] = useState(false)
  const [savedSize, setSavedSize] = useState<LogicalSize | null>(null)
  const [compactCorner, setCompactCornerState] = useState<CompactCorner>(() => {
    return (localStorage.getItem(CORNER_KEY) as CompactCorner) || "auto"
  })

  const compactModeRef = useRef(compactMode)
  compactModeRef.current = compactMode

  const compactCornerRef = useRef(compactCorner)
  compactCornerRef.current = compactCorner

  const savedPositionRef = useRef<PhysicalPosition | null>(null)
  const savedPhysSizeRef = useRef<PhysicalSize | null>(null)

  const setCompactCorner = useCallback((corner: CompactCorner) => {
    setCompactCornerState(corner)
    localStorage.setItem(CORNER_KEY, corner)
  }, [])

  const enterCompact = useCallback(async () => {
    if (compactModeRef.current) return
    try {
      const win = getCurrentWindow()
      const current = await win.innerSize()
      setSavedSize(new LogicalSize(current))

      savedPhysSizeRef.current = new PhysicalSize(current.width, current.height)
      savedPositionRef.current = await win.outerPosition()

      await win.setSizeConstraints(null)
      await win.setResizable(true)
      await win.setSize(COMPACT)
      await win.setResizable(false)

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

      setCompactMode(true)
    } catch (e) {
      toast.error(`Compact mode failed: ${e}`)
    }
  }, [])

  const exitCompact = useCallback(async () => {
    if (!compactModeRef.current) return
    try {
      const win = getCurrentWindow()
      const savedPos = savedPositionRef.current
      if (savedPos) {
        await win.setPosition(savedPos)
      }
      await win.setSize(savedSize ?? new LogicalSize(660, 720))
      await win.setResizable(true)
      await win.setSizeConstraints(MIN_CONSTRAINTS)
    } catch (e) {
      toast.error(`Restore mode failed: ${e}`)
    }
    setCompactMode(false)
  }, [savedSize])

  return { compactMode, compactCorner, setCompactCorner, enterCompact, exitCompact }
}
