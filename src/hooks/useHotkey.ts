import { useEffect, useRef } from "react"
import { toast } from "sonner"

type UseHotkeyArgs = {
  hotkey: string
  setHotkey: (key: string) => void
  capturing: boolean
  setCapturing: (capturing: boolean) => void
  onToggle: () => void
}

export function useHotkey({
  hotkey,
  setHotkey,
  capturing,
  setCapturing,
  onToggle,
}: UseHotkeyArgs) {
  const onToggleRef = useRef(onToggle)
  onToggleRef.current = onToggle

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (capturing) {
        e.preventDefault()
        if (e.key === "Escape") {
          setCapturing(false)
          return
        }
        setHotkey(e.key)
        setCapturing(false)
        toast(`Hotkey bound to ${e.key}`)
        return
      }
      const el = document.activeElement
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return
      if (e.key === hotkey) {
        e.preventDefault()
        onToggleRef.current()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [hotkey, capturing, setHotkey, setCapturing])
}
