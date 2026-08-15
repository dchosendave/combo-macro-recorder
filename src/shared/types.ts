export type PotionKey = "q" | "w" | "e" | "r"
export type RepeatMode = "loop" | "count"
export type StepLabelStyle = "abbreviation" | "icon"
export type CompactCorner = "auto" | "top-right" | "top-left" | "bottom-right" | "bottom-left"
export type HotkeyMode = "toggle" | "hold" | "start" | "stop" | "cycle"

/** Auto-stop-on-focus-loss: stops the macro when the configured game window loses focus. `gameProcess` is the game's executable name (e.g. `main.exe`); an empty name disables matching. */
export type AutoStopConfig = {
  enabled: boolean
  gameProcess: string
}

export type SkillStep = (
  | { id: string; type: "keydown"; key: string }
  | { id: string; type: "keyup"; key: string }
  | { id: string; type: "delay"; ms: string }
) & { disabled?: boolean }

export type PotionConfig = {
  enabled: boolean
  keys: Record<PotionKey, boolean>
  customDelay: boolean
  delayMs: string
  repeatMode: RepeatMode
  repeatCount: string
}

export type SkillConfig = {
  enabled: boolean
  holdRightClick: boolean
  steps: SkillStep[]
  labelStyle: StepLabelStyle
  repeatMode: RepeatMode
  repeatCount: string
  playbackSpeed?: string
}

export type HotkeyBinding = {
  id: string
  name: string
  hotkey: string
  comboPath: string
  mode?: HotkeyMode
  comboPaths?: string[]
}

export type CurrentCombo = {
  potions: PotionConfig
  skills: SkillConfig
}

export type SettingsV3 = {
  version: 3
  current: CurrentCombo
  hotkeys: HotkeyBinding[]
}
