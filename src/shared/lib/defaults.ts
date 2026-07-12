import type {
  HotkeyBinding,
  PotionConfig,
  SettingsV3,
  SkillConfig,
} from "./types"

export const MIN_DELAY = 2
export const MIN_REPEAT = 1

export function defaultPotionConfig(): PotionConfig {
  return {
    enabled: false,
    keys: { q: true, w: true, e: true, r: true },
    customDelay: false,
    delayMs: String(MIN_DELAY),
    repeatMode: "loop",
    repeatCount: "1",
  }
}

export function defaultSkillConfig(): SkillConfig {
  return {
    enabled: false,
    holdRightClick: false,
    steps: [],
    labelStyle: "abbreviation",
    repeatMode: "loop",
    repeatCount: "1",
  }
}

export function defaultHotkeyBinding(): HotkeyBinding {
  return {
    id: crypto.randomUUID(),
    name: "Untitled",
    hotkey: "F5",
    comboPath: "",
  }
}

export const DEFAULTS: SettingsV3 = {
  version: 3,
  current: {
    potions: defaultPotionConfig(),
    skills: defaultSkillConfig(),
  },
  hotkeys: [defaultHotkeyBinding()],
}

export function makeDefaultSettings(): SettingsV3 {
  const binding = defaultHotkeyBinding()
  return {
    version: 3,
    current: {
      potions: defaultPotionConfig(),
      skills: defaultSkillConfig(),
    },
    hotkeys: [binding],
  }
}
