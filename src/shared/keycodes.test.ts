import { describe, it, expect } from "vitest"
import { codeToShortcut, codeToLabel } from "./keycodes"

describe("codeToShortcut", () => {
  const cases: Array<[string, string]> = [
    ["KeyQ", "Q"],
    ["Digit1", "1"],
    ["Numpad0", "0"],
    ["F5", "F5"],
    ["F12", "F12"],
    ["Control+F5", "Control+F5"],
    ["Shift+KeyA", "Shift+A"],
    ["ArrowUp", "Up"],
    ["Space", "Space"],
    ["Backspace", "Backspace"],
    ["ControlLeft", "ControlLeft"],
    ["KeyQ+KeyW", "Q+W"],
    ["FancyKey", "FancyKey"],
    ["control+f5", "control+f5"],
  ]

  it.each(cases)("%s -> %s", (input, expected) => {
    expect(codeToShortcut(input)).toBe(expected)
  })
})

describe("codeToLabel", () => {
  const cases: Array<[string, string]> = [
    ["Control+F5", "Ctrl+F5"],
    ["Shift+KeyA", "Shift+A"],
    ["Meta+KeyQ", "Cmd+Q"],
    ["Numpad0", "Num0"],
    ["ArrowUp", "\u2191"],
    ["PageUp", "PgUp"],
    ["Backspace", "\u232b"],
    ["Delete", "Del"],
    ["Escape", "Esc"],
    ["F12", "F12"],
    ["FancyKey", "FancyKey"],
    ["control+f5", "control+f5"],
  ]

  it.each(cases)("%s -> %s", (input, expected) => {
    expect(codeToLabel(input)).toBe(expected)
  })
})
