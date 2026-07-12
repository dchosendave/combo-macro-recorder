import { useCallback, useRef, useState } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { LogicalSize } from "@tauri-apps/api/dpi"
import { toast } from "sonner"

const COMPACT = new LogicalSize(500, 68)
const MIN_CONSTRAINTS = { minWidth: 660, minHeight: 720 }

export function useCompactMode() {
  const [compactMode, setCompactMode] = useState(false)
  const [savedSize, setSavedSize] = useState<LogicalSize | null>(null)

  const compactModeRef = useRef(compactMode)
  compactModeRef.current = compactMode

  const enterCompact = useCallback(async () => {
    if (compactModeRef.current) return
    try {
      const win = getCurrentWindow()
      const current = await win.innerSize()
      setSavedSize(new LogicalSize(current))
      await win.setSizeConstraints(null)
      await win.setResizable(true)
      await win.setSize(COMPACT)
      await win.setResizable(false)
      setCompactMode(true)
    } catch (e) {
      toast.error(`Compact mode failed: ${e}`)
    }
  }, [])

  const exitCompact = useCallback(async () => {
    if (!compactModeRef.current) return
    try {
      const win = getCurrentWindow()
      await win.setSize(savedSize ?? new LogicalSize(660, 720))
      await win.setResizable(true)
      await win.setSizeConstraints(MIN_CONSTRAINTS)
    } catch (e) {
      toast.error(`Restore mode failed: ${e}`)
    }
    setCompactMode(false)
  }, [savedSize])

  return { compactMode, enterCompact, exitCompact }
}
