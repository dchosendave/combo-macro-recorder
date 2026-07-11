import { useEffect } from "react"
import { toast } from "sonner"

type UseHotkeyArgs = {
  setHotkey: (key: string) => void
  capturing: boolean
  setCapturing: (capturing: boolean) => void
}

export function useHotkey({
  setHotkey,
  capturing,
  setCapturing,
}: UseHotkeyArgs) {
  useEffect(() => {
    if (!capturing) return
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      if (e.key === "Escape") {
        setCapturing(false)
        return
      }
      setHotkey(e.key)
      setCapturing(false)
      toast(`Hotkey bound to ${e.key}`)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [capturing, setHotkey, setCapturing])
}
