import type { SkillStep } from "@/shared/types"

const NAMED_KEYS = [
  "Space", "Enter", "Escape", "Tab", "Backspace", "Delete", "Insert",
  "Home", "End", "PageUp", "PageDown", "Left", "Right", "Up", "Down",
] as const

// Playback/import/recording continue to recognize the full backend vocabulary,
// even though the picker intentionally exposes only the common subset.
const INTERNAL_FUNCTION_KEYS = Array.from({ length: 24 }, (_, index) => `F${index + 1}`)
const INTERNAL_NUMPAD_KEYS = Array.from({ length: 10 }, (_, index) => `Num${index}`)

export const SKILL_KEY_GROUPS = [
  { label: "Letters", keys: Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index)) },
  { label: "Numbers", keys: Array.from({ length: 10 }, (_, index) => String(index)) },
  { label: "Common keys", keys: [...NAMED_KEYS] },
  { label: "Function keys", keys: Array.from({ length: 12 }, (_, index) => `F${index + 1}`) },
] as const

const NAMED_LOOKUP = new Map(
  [...NAMED_KEYS, ...INTERNAL_FUNCTION_KEYS, ...INTERNAL_NUMPAD_KEYS]
    .map((key) => [key.toUpperCase(), key]),
)
NAMED_LOOKUP.set("ESC", "Escape")
NAMED_LOOKUP.set("DEL", "Delete")
NAMED_LOOKUP.set("PGUP", "PageUp")
NAMED_LOOKUP.set("PGDN", "PageDown")

export function normalizeSkillKey(raw: string): string | null {
  const key = raw.trim()
  if (!key) return null
  if ([...key].length === 1) return key.toUpperCase()
  return NAMED_LOOKUP.get(key.toUpperCase()) ?? null
}

export function eventCodeToSkillKey(code: string): string | null {
  if (code.startsWith("Key")) return code.slice(3)
  if (code.startsWith("Digit")) return code.slice(5)
  if (code.startsWith("Numpad") && /^Numpad\d$/.test(code)) return `Num${code.slice(6)}`
  if (/^F(?:[1-9]|1\d|2[0-4])$/.test(code)) return code
  const named: Record<string, string> = {
    Space: "Space", Enter: "Enter", Escape: "Escape", Tab: "Tab",
    Backspace: "Backspace", Delete: "Delete", Insert: "Insert", Home: "Home",
    End: "End", PageUp: "PageUp", PageDown: "PageDown", ArrowLeft: "Left",
    ArrowRight: "Right", ArrowUp: "Up", ArrowDown: "Down", Semicolon: ";",
    Equal: "=", Comma: ",", Minus: "-", Period: ".", Slash: "/",
    Backquote: "`", BracketLeft: "[", Backslash: "\\", BracketRight: "]", Quote: "'",
  }
  return named[code] ?? null
}

export type SkillStepAnalysis = {
  invalidStepIds: string[]
  unmatchedKeydowns: string[]
}

export function analyzeSkillSteps(steps: SkillStep[]): SkillStepAnalysis {
  const invalidStepIds: string[] = []
  const held = new Map<string, number>()
  for (const step of steps) {
    if (step.disabled) continue
    if (step.type === "delay") continue
    const key = normalizeSkillKey(step.key)
    if (!key) {
      invalidStepIds.push(step.id)
      continue
    }
    const count = held.get(key) ?? 0
    if (step.type === "keydown") held.set(key, count + 1)
    else if (count > 0) held.set(key, count - 1)
  }
  return {
    invalidStepIds,
    unmatchedKeydowns: [...held].filter(([, count]) => count > 0).map(([key]) => key),
  }
}
