import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, resolve } from "path"
import { parseJitbit } from "./parsers"
import type { SkillStep } from "@/shared/types"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const macrosDir = resolve(__dirname, "../../macros")

function stripId(steps: SkillStep[]) {
  return steps.map(({ id: _id, ...rest }) => rest)
}

describe("parseJitbit from .mcr fixtures", () => {
  const files = readdirSync(macrosDir).filter((f) => f.endsWith(".mcr"))

  for (const file of files) {
    it(`parses ${file} correctly`, () => {
      const content = readFileSync(`${macrosDir}/${file}`, "utf-8")
      const result = parseJitbit(content)
      expect(stripId(result)).toMatchSnapshot()
    })
  }
})

describe("parseJitbit edge cases", () => {
  it("handles empty string", () => {
    expect(parseJitbit("")).toEqual([])
  })

  it("handlines with only whitespace", () => {
    expect(parseJitbit("  \n  \n  ")).toEqual([])
  })

  it("handles a single keydown", () => {
    const result = parseJitbit("Keyboard : D5 : KeyDown")
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ type: "keydown", key: "5" })
  })

  it("handles a single keyup", () => {
    const result = parseJitbit("Keyboard : A : KeyUp")
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ type: "keyup", key: "A" })
  })

  it("handles a single delay", () => {
    const result = parseJitbit("DELAY : 250")
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ type: "delay", ms: "250" })
  })

  it("skips unknown key tokens (F12, multi-char non-D)", () => {
    const result = parseJitbit("Keyboard : F12 : KeyDown")
    expect(result).toEqual([])
  })

  it("is case-insensitive", () => {
    const result = parseJitbit("KEYBOARD : D1 : KEYDOWN\ndelay : 50")
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ type: "keydown", key: "1" })
    expect(result[1]).toMatchObject({ type: "delay", ms: "50" })
  })

  it("preserves lowercase single-letter keys", () => {
    const result = parseJitbit("keyboard : a : keydown")
    expect(result[0]).toMatchObject({ type: "keydown", key: "a" })
  })

  it("strips D prefix from d0-d9 (lowercase)", () => {
    const result = parseJitbit("keyboard : d0 : keydown\nkeyboard : d9 : keyup")
    expect(result[0]).toMatchObject({ type: "keydown", key: "0" })
    expect(result[1]).toMatchObject({ type: "keyup", key: "9" })
  })
})
