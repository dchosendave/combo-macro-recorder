import { describe, it, expect, beforeEach } from "vitest"
import { loadHotkeys, saveHotkeys, clearHotkeys, STORAGE_KEY } from "./persistence"

function seed(raw: string) {
  localStorage.setItem(STORAGE_KEY, raw)
}

describe("loadHotkeys", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("returns a default binding when storage is empty", () => {
    const bindings = loadHotkeys()
    expect(bindings).toHaveLength(1)
    const [binding] = bindings
    expect(binding.name).toBe("Untitled")
    expect(binding.hotkey).toBe("F5")
    expect(binding.comboPath).toBe("")
    expect(typeof binding.id).toBe("string")
    expect(binding.id.length).toBeGreaterThan(0)
  })

  it("returns a valid v3 payload as stored", () => {
    seed(
      JSON.stringify({
        version: 3,
        hotkeys: [{ id: "a", name: "N", hotkey: "F6", comboPath: "/x.json" }],
      }),
    )
    expect(loadHotkeys()).toEqual([
      { id: "a", name: "N", hotkey: "F6", comboPath: "/x.json" },
    ])
  })

  it("falls back to defaults when v3 hotkeys is empty", () => {
    seed(JSON.stringify({ version: 3, hotkeys: [] }))
    const [binding] = loadHotkeys()
    expect(binding.name).toBe("Untitled")
    expect(binding.hotkey).toBe("F5")
    expect(binding.comboPath).toBe("")
    expect(binding.id.length).toBeGreaterThan(0)
  })

  it("migrates v2 into a single default-shaped binding", () => {
    seed(JSON.stringify({ version: 2, hotkey: "F6" }))
    const bindings = loadHotkeys()
    expect(bindings).toHaveLength(1)
    const [binding] = bindings
    expect(binding.name).toBe("Untitled")
    expect(binding.hotkey).toBe("F6")
    expect(binding.comboPath).toBe("")
    expect(typeof binding.id).toBe("string")
    expect(binding.id.length).toBeGreaterThan(0)
  })

  it("v2 without hotkey falls back to F5", () => {
    seed(JSON.stringify({ version: 2 }))
    expect(loadHotkeys()[0].hotkey).toBe("F5")
  })

  it("v1 with hotkey keeps it on a default binding", () => {
    seed(JSON.stringify({ hotkey: "F7" }))
    const [binding] = loadHotkeys()
    expect(binding.hotkey).toBe("F7")
    expect(binding.name).toBe("Untitled")
    expect(binding.comboPath).toBe("")
  })

  it("v1 without hotkey falls back to F5", () => {
    seed(JSON.stringify({}))
    expect(loadHotkeys()[0].hotkey).toBe("F5")
  })

  it("corrupt JSON degrades to defaults", () => {
    seed("{oops")
    const [binding] = loadHotkeys()
    expect(binding.name).toBe("Untitled")
    expect(binding.hotkey).toBe("F5")
  })
})

describe("saveHotkeys / clearHotkeys", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("save then load round-trips and stores version 3", () => {
    const hotkeys = [
      { id: "a", name: "N", hotkey: "F6", comboPath: "/x.json" },
      { id: "b", name: "M", hotkey: "F7", comboPath: "" },
    ]
    saveHotkeys(hotkeys)
    expect(loadHotkeys()).toEqual(hotkeys)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")).toEqual({
      version: 3,
      hotkeys,
    })
  })

  it("clearHotkeys removes the storage key", () => {
    saveHotkeys([{ id: "a", name: "N", hotkey: "F6", comboPath: "" }])
    clearHotkeys()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    // Back to defaults after clearing.
    expect(loadHotkeys()[0].hotkey).toBe("F5")
  })
})
