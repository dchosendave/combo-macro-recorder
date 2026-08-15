import { describe, it, expect } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { defaultHotkeyBinding } from "@/shared/defaults"
import { useHotkeySettings } from "./use-hotkey-settings"
import type { HotkeyBinding } from "@/shared/types"

const TWO_BINDINGS: HotkeyBinding[] = [
  { id: "h1", name: "First", hotkey: "Control+F5", comboPath: "C:\\combos\\a.json" },
  { id: "h2", name: "Second", hotkey: "F6", comboPath: "" },
]

const ONE_BINDING: HotkeyBinding[] = [
  { ...defaultHotkeyBinding(), id: "h1" },
]

describe("useHotkeySettings", () => {
  it("addHotkey appends a default binding named after the new length", () => {
    const { result } = renderHook(() => useHotkeySettings(ONE_BINDING))
    act(() => result.current.addHotkey())
    expect(result.current.hotkeys).toHaveLength(2)
    const added = result.current.hotkeys[1]
    expect(added.name).toBe("Hotkey 2")
    expect(added.hotkey).toBe("F5")
    expect(added.comboPath).toBe("")
    expect(added.id).not.toBe("")
    expect(added.id).not.toBe("h1")
  })

  it("addHotkey numbering follows the current list length", () => {
    const { result } = renderHook(() => useHotkeySettings(TWO_BINDINGS))
    act(() => result.current.addHotkey())
    expect(result.current.hotkeys[2].name).toBe("Hotkey 3")
  })

  it("deleteHotkey removes the binding and no-ops when only one remains", () => {
    const { result } = renderHook(() => useHotkeySettings(TWO_BINDINGS))
    act(() => result.current.deleteHotkey("h1"))
    expect(result.current.hotkeys.map((h) => h.id)).toEqual(["h2"])

    act(() => result.current.deleteHotkey("h2"))
    expect(result.current.hotkeys.map((h) => h.id)).toEqual(["h2"])
  })

  it("moveHotkeyUp reorders and no-ops at the top", () => {
    const { result } = renderHook(() => useHotkeySettings(TWO_BINDINGS))
    act(() => result.current.moveHotkeyUp("h2"))
    expect(result.current.hotkeys.map((h) => h.id)).toEqual(["h2", "h1"])
    act(() => result.current.moveHotkeyUp("h2"))
    expect(result.current.hotkeys.map((h) => h.id)).toEqual(["h2", "h1"])
  })

  it("moveHotkeyDown reorders and no-ops at the bottom", () => {
    const { result } = renderHook(() => useHotkeySettings(TWO_BINDINGS))
    act(() => result.current.moveHotkeyDown("h1"))
    expect(result.current.hotkeys.map((h) => h.id)).toEqual(["h2", "h1"])
    act(() => result.current.moveHotkeyDown("h1"))
    expect(result.current.hotkeys.map((h) => h.id)).toEqual(["h2", "h1"])
    act(() => result.current.moveHotkeyDown("missing"))
    expect(result.current.hotkeys.map((h) => h.id)).toEqual(["h2", "h1"])
  })

  it("updateHotkeyBinding, updateHotkeyPath and renameHotkey patch in place", () => {
    const { result } = renderHook(() => useHotkeySettings(TWO_BINDINGS))
    act(() => {
      result.current.updateHotkeyBinding("h1", "Shift+F6")
      result.current.updateHotkeyPath("h1", "C:\\combos\\new.json")
      result.current.renameHotkey("h1", "Renamed")
    })
    expect(result.current.hotkeys[0]).toEqual({
      id: "h1",
      name: "Renamed",
      hotkey: "Shift+F6",
      comboPath: "C:\\combos\\new.json",
    })
    expect(result.current.hotkeys[1]).toEqual(TWO_BINDINGS[1])
  })

  it("stores the mode and ordered cycle paths", () => {
    const { result } = renderHook(() => useHotkeySettings(ONE_BINDING))
    act(() => {
      result.current.updateHotkeyMode("h1", "cycle")
      result.current.updateHotkeyCyclePaths("h1", ["a.json", "b.json"])
    })
    expect(result.current.hotkeys[0]).toMatchObject({
      mode: "cycle",
      comboPaths: ["a.json", "b.json"],
    })
  })

  it("hotkey is the first binding's hotkey, falling back to F5 when empty", () => {
    const { result } = renderHook(() => useHotkeySettings(TWO_BINDINGS))
    expect(result.current.hotkey).toBe("Control+F5")
    act(() => result.current.moveHotkeyUp("h2"))
    expect(result.current.hotkey).toBe("F6")

    const empty = renderHook(() => useHotkeySettings([]))
    expect(empty.result.current.hotkey).toBe("F5")
    expect(empty.result.current.hotkeys).toEqual([])
  })
})
