import { useCallback, useState } from "react"
import type { HotkeyBinding } from "@/shared/lib/types"

export function useHotkeySettings(initial: HotkeyBinding[]) {
  const [hotkeys, setHotkeys] = useState<HotkeyBinding[]>(initial)

  const addHotkey = useCallback(() => {
    setHotkeys((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: `Hotkey ${prev.length + 1}`,
        hotkey: "F5",
        comboPath: "",
      },
    ])
  }, [])

  const deleteHotkey = useCallback((id: string) => {
    setHotkeys((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((p) => p.id !== id)
    })
  }, [])

  const renameHotkey = useCallback((id: string, name: string) => {
    setHotkeys((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)))
  }, [])

  const updateHotkeyBinding = useCallback((id: string, hotkey: string) => {
    setHotkeys((prev) => prev.map((p) => (p.id === id ? { ...p, hotkey } : p)))
  }, [])

  const updateHotkeyPath = useCallback((id: string, comboPath: string) => {
    setHotkeys((prev) => prev.map((p) => (p.id === id ? { ...p, comboPath } : p)))
  }, [])

  const moveHotkeyUp = useCallback((id: string) => {
    setHotkeys((prev) => {
      const idx = prev.findIndex((p) => p.id === id)
      if (idx <= 0) return prev
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }, [])

  const moveHotkeyDown = useCallback((id: string) => {
    setHotkeys((prev) => {
      const idx = prev.findIndex((p) => p.id === id)
      if (idx < 0 || idx >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[idx + 1], next[idx]] = [next[idx], next[idx + 1]]
      return next
    })
  }, [])

  const hotkey = hotkeys.length > 0 ? hotkeys[0].hotkey : "F5"

  return {
    hotkeys, setHotkeys,
    addHotkey, deleteHotkey, renameHotkey,
    updateHotkeyBinding, updateHotkeyPath,
    moveHotkeyUp, moveHotkeyDown,
    hotkey,
    persisted: hotkeys,
  }
}
