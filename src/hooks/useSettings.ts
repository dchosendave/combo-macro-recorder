import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  DEFAULTS,
  MIN_DELAY,
  MIN_REPEAT,
  clearSettings,
  loadSettings,
  saveSettings,
  type PotionKey,
  type RepeatMode,
  type Settings,
} from "@/lib/settings"

export function useSettings() {
  const initial = loadSettings()

  const [autoPotions, setAutoPotions] = useState(initial.autoPotions)
  const [keys, setKeys] = useState<Record<PotionKey, boolean>>(initial.keys)
  const [customDelay, setCustomDelay] = useState(initial.customDelay)
  const [delayMs, setDelayMs] = useState(initial.delayMs)
  const [hotkey, setHotkey] = useState(initial.hotkey)
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(initial.repeatMode)
  const [repeatCount, setRepeatCount] = useState(initial.repeatCount)

  const delayError =
    customDelay && delayMs !== "" && Number(delayMs) < MIN_DELAY
  const repeatError =
    repeatMode === "count" &&
    (repeatCount === "" || Number(repeatCount) < MIN_REPEAT)
  const anyKeyEnabled = Object.values(keys).some(Boolean)
  const canRun = autoPotions && anyKeyEnabled && !delayError && !repeatError

  const togglePotionKey = (key: PotionKey) =>
    setKeys((prev) => ({ ...prev, [key]: !prev[key] }))

  const setCustomDelayEnabled = (enabled: boolean) => {
    setCustomDelay(enabled)
    if (!enabled) setDelayMs(String(MIN_DELAY))
  }

  const reset = () => {
    setAutoPotions(DEFAULTS.autoPotions)
    setKeys(DEFAULTS.keys)
    setCustomDelay(DEFAULTS.customDelay)
    setDelayMs(DEFAULTS.delayMs)
    setHotkey(DEFAULTS.hotkey)
    setRepeatMode(DEFAULTS.repeatMode)
    setRepeatCount(DEFAULTS.repeatCount)
    clearSettings()
    toast("Settings reset to defaults")
  }

  useEffect(() => {
    const settings: Settings = {
      autoPotions,
      keys,
      customDelay,
      delayMs,
      hotkey,
      repeatMode,
      repeatCount,
    }
    saveSettings(settings)
  }, [autoPotions, keys, customDelay, delayMs, hotkey, repeatMode, repeatCount])

  return {
    autoPotions,
    setAutoPotions,
    keys,
    togglePotionKey,
    customDelay,
    setCustomDelayEnabled,
    delayMs,
    setDelayMs,
    hotkey,
    setHotkey,
    repeatMode,
    setRepeatMode,
    repeatCount,
    setRepeatCount,
    delayError,
    repeatError,
    canRun,
    reset,
  }
}
