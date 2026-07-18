import { useCallback, useMemo, useState } from "react"
import { MAX_REPEAT, MIN_DELAY, MIN_REPEAT } from "@/shared/defaults"
import type { PotionConfig, PotionKey, RepeatMode } from "@/shared/types"

export function usePotionSettings(initial: PotionConfig) {
  const [potionsEnabled, setPotionsEnabled] = useState(initial.enabled)
  const [potionKeys, setPotionKeys] = useState(initial.keys)
  const [customDelay, setCustomDelay] = useState(initial.customDelay)
  const [delayMs, setDelayMs] = useState(initial.delayMs)
  const [potionsRepeatMode, setPotionsRepeatMode] = useState<RepeatMode>(initial.repeatMode)
  const [potionsRepeatCount, setPotionsRepeatCount] = useState(initial.repeatCount)

  const potionsDelayError =
    customDelay && delayMs !== "" && Number(delayMs) < MIN_DELAY
  const potionsRepeatError =
    potionsRepeatMode === "count" &&
    (potionsRepeatCount === "" || Number(potionsRepeatCount) < MIN_REPEAT)
  const anyPotionKeyEnabled = Object.values(potionKeys).some(Boolean)
  const potionsCanRun =
    potionsEnabled && anyPotionKeyEnabled && !potionsDelayError && !potionsRepeatError

  const togglePotionKey = (key: PotionKey) =>
    setPotionKeys((prev) => ({ ...prev, [key]: !prev[key] }))

  const setCustomDelayEnabled = (enabled: boolean) => {
    setCustomDelay(enabled)
    if (!enabled) setDelayMs(String(MIN_DELAY))
  }

  const apply = useCallback((config: PotionConfig) => {
    setPotionsEnabled(config.enabled)
    setPotionKeys(config.keys)
    setCustomDelay(config.customDelay)
    setDelayMs(config.delayMs)
    setPotionsRepeatMode(config.repeatMode)
    setPotionsRepeatCount(config.repeatCount)
  }, [])

  const persisted = useMemo<PotionConfig>(
    () => ({
      enabled: potionsEnabled,
      keys: potionKeys,
      customDelay,
      delayMs,
      repeatMode: potionsRepeatMode,
      repeatCount: potionsRepeatCount,
    }),
    [potionsEnabled, potionKeys, customDelay, delayMs, potionsRepeatMode, potionsRepeatCount],
  )

  const potionsConfig = useMemo(
    () => ({
      keys: potionKeys,
      delayMs: !potionsDelayError && delayMs !== "" ? Number(delayMs) : MIN_DELAY,
      repeatMode: potionsRepeatMode,
      repeatCount: Math.min(MAX_REPEAT, Math.max(MIN_REPEAT, Number(potionsRepeatCount) || MIN_REPEAT)),
    }),
    [potionKeys, delayMs, potionsDelayError, potionsRepeatMode, potionsRepeatCount],
  )

  return {
    potionsEnabled, setPotionsEnabled,
    potionKeys, togglePotionKey,
    customDelay, setCustomDelayEnabled,
    delayMs, setDelayMs,
    potionsRepeatMode, setPotionsRepeatMode,
    potionsRepeatCount, setPotionsRepeatCount,
    potionsDelayError, potionsRepeatError, potionsCanRun,
    apply,
    persisted,
    potionsConfig,
  }
}
