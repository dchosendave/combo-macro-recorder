import { useCallback, useMemo, useState } from "react"
import { MIN_DELAY } from "@/shared/defaults"
import { derivePotionRun } from "@/shared/run-validation"
import type { PotionConfig, PotionKey, RepeatMode } from "@/shared/types"

export function usePotionSettings(initial: PotionConfig) {
  const [potionsEnabled, setPotionsEnabled] = useState(initial.enabled)
  const [potionKeys, setPotionKeys] = useState(initial.keys)
  const [customDelay, setCustomDelay] = useState(initial.customDelay)
  const [delayMs, setDelayMs] = useState(initial.delayMs)
  const [potionsRepeatMode, setPotionsRepeatMode] = useState<RepeatMode>(initial.repeatMode)
  const [potionsRepeatCount, setPotionsRepeatCount] = useState(initial.repeatCount)

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

  // Can-run gating + backend config come from the shared derivation, so
  // tabs-edited combos and file-loaded combos behave identically.
  const derivation = useMemo(() => derivePotionRun(persisted), [persisted])
  const potionsDelayError = derivation.delayError
  const potionsRepeatError = derivation.repeatError
  const potionsCanRun = derivation.canRun
  const potionsConfig = derivation.config

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
