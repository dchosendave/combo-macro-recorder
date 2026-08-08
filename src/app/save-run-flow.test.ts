import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { invokeMock, fireTauriEvent } from "@/test/tauri-utils"
import { exportComboToString } from "@/combo-file/combo-io"
import { defaultPotionConfig, defaultSkillConfig } from "@/shared/defaults"
import type { CurrentCombo, HotkeyBinding } from "@/shared/types"
import { useSettings } from "./use-settings"
import { useComboFile } from "@/combo-file/use-combo-file"
import { useGlobalHotkeys } from "@/hotkeys/use-global-hotkeys"

const PATH = "C:\\combos\\a.json"
const AUTO_LOAD_KEY = "combo-macro-auto-load"
const LAST_PATH_KEY = "combo-macro-last-path"
const PROFILE: HotkeyBinding = { id: "p1", name: "P1", hotkey: "Control+F5", comboPath: PATH }

function comboWithHold(holdRightClick: boolean): CurrentCombo {
  return {
    potions: defaultPotionConfig(),
    skills: {
      ...defaultSkillConfig(),
      enabled: true,
      holdRightClick,
      steps: [{ id: "s1", type: "keydown", key: "1" }],
    },
  }
}

/** Wires the app's settings + combo-file + hotkey hooks together, with `onSave` invalidating the hotkey cache exactly as App.tsx does. */
function useAppFlow() {
  const settings = useSettings()
  const runningProfileIdRef = { current: null as string | null }
  const { clearCachedCombo } = useGlobalHotkeys({
    hotkeys: [PROFILE],
    toggleRunning: vi.fn(),
    startCombo: vi.fn(),
    stopAll: vi.fn(),
    applyCombo: settings.applyCombo,
    runningProfileIdRef,
  })
  const comboFile = useComboFile({
    getCombo: () => settings.buildSettings().current,
    applyCombo: settings.applyCombo,
    onSave: (path) => clearCachedCombo(path),
  })
  return { settings, comboFile }
}

/** Stateful disk mock: `read_file` serves the current disk content, `save_file` replaces it. */
function diskMock() {
  let disk = exportComboToString(comboWithHold(true))
  const mock = (cmd: string, args: unknown = {}) => {
    if (cmd === "read_file") return Promise.resolve(disk)
    if (cmd === "save_file" && typeof args === "object" && args !== null && "content" in args) {
      disk = String(args.content)
      return Promise.resolve(undefined)
    }
    return Promise.resolve(undefined)
  }
  return { mock, disk: () => disk }
}

beforeEach(() => {
  vi.useFakeTimers()
  invokeMock.mockResolvedValue(undefined)
})

describe("save → run → reload flow", () => {
  it("a saved holdRightClick=false survives auto-load, save, and a hotkey run", async () => {
    const { mock, disk } = diskMock()
    invokeMock.mockImplementation(mock)
    localStorage.setItem(AUTO_LOAD_KEY, "true")
    localStorage.setItem(LAST_PATH_KEY, PATH)

    const { result } = renderHook(() => useAppFlow())

    // Startup auto-loads the file → tabs show holdRightClick ON.
    await act(async () => {
      await result.current.comboFile.tryAutoLoad()
    })
    expect(result.current.settings.holdRightClick).toBe(true)

    // User disables it and saves.
    act(() => result.current.settings.setHoldRightClick(false))
    await act(async () => {
      await result.current.comboFile.saveFile()
    })
    expect(JSON.parse(disk()).skills.holdRightClick).toBe(false)

    // Hotkey press loads the file and reflects it in the tabs — must be OFF.
    await act(async () => {
      await fireTauriEvent("macro-toggle", "p1")
    })
    expect(result.current.settings.holdRightClick).toBe(false)
  })
})
