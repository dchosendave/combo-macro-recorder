import type { SkillStep } from "@/shared/types"

/**
 * Named key tokens accepted by Jitbit import. Mirrors the backend's `parse_key`
 * vocabulary (`src-tauri/src/runner/injector.rs`), so anything that can be
 * replayed can also be imported. Keep the two in sync.
 */
const KEY_TOKENS: Record<string, true> = Object.fromEntries([
  ["SPACE", true], ["ENTER", true], ["ESCAPE", true], ["TAB", true],
  ["BACKSPACE", true], ["DELETE", true], ["INSERT", true], ["HOME", true],
  ["END", true], ["PAGEUP", true], ["PAGEDOWN", true], ["LEFT", true],
  ["RIGHT", true], ["UP", true], ["DOWN", true],
  ...Array.from({ length: 24 }, (_, i) => [`F${i + 1}`, true]),
  ...Array.from({ length: 10 }, (_, i) => [`NUM${i}`, true]),
])

/** Normalize a raw Jitbit key token into a canonical key string.
 *  - D0–D9 → strip the D prefix (top-row digit keys vs numpad)
 *  - Single alphanumeric chars pass through
 *  - Named tokens (Space, F1, Num0, PageUp, …) pass through as uppercase
 *  - Everything else → null (invalid) */
function normalizeKey(raw: string): string | null {
  if (/^D[0-9]$/i.test(raw)) return raw[1]
  if (/^[A-Za-z0-9]$/.test(raw)) return raw
  const upper = raw.toUpperCase()
  if (KEY_TOKENS[upper]) return upper
  return null
}

/** Parse a Jitbit Macro Recorder script (lines of `DELAY : N` and `Keyboard : KEY : KeyDown|KeyUp`). Invalid keys are skipped. */
export function parseJitbit(text: string): SkillStep[] {
  const steps: SkillStep[] = []
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

  for (const line of lines) {
    if (/^DELAY\s*:\s*(\d+)/i.test(line)) {
      const ms = line.match(/^DELAY\s*:\s*(\d+)/i)![1]
      steps.push({ id: crypto.randomUUID(), type: "delay", ms })
      continue
    }

    const kbdMatch = line.match(/^Keyboard\s*:\s*([A-Za-z0-9]+)\s*:\s*(KeyDown|KeyUp)/i)
    if (kbdMatch) {
      const raw = kbdMatch[1]
      const key = normalizeKey(raw)
      if (!key) continue
      const action = kbdMatch[2].toLowerCase() === "keydown" ? "keydown" : "keyup"
      steps.push({ id: crypto.randomUUID(), type: action, key })
      continue
    }
  }

  return steps
}

/**
 * Strict file import: parses a whole `.mcr` script and REQUIRES every row to
 * be a keyboard row (`DELAY : N` or `Keyboard : KEY : KeyDown|KeyUp`). Any
 * other row — mouse movements/clicks (x/y coordinates), text typing, unknown
 * commands — rejects the entire file with the offending line, so a partially
 * imported macro can never silently drop actions. Unsupported key tokens on
 * Keyboard rows (e.g. modifier keys) are skipped as usual.
 *
 * One tolerated exception: a SINGLE `Mouse : … : RightButtonDown : …` row is
 * stripped when it sits at the very first or very last non-blank row (Jitbit
 * records the game-focus click / attack hold there). Anywhere else, or more
 * than once, it's real mouse interaction and the file is rejected.
 */
export type JitbitRejection = {
  line: number
  text: string
  reason: string
}

export type JitbitFileParse = { steps: SkillStep[] } | { rejected: JitbitRejection }

/** True for Jitbit mouse rows like `Mouse : 0 : 0 : RightButtonDown : 0 : 1 : 0`. */
function isRightButtonDownRow(line: string): boolean {
  const fields = line.split(":").map((f) => f.trim().toLowerCase())
  return fields[0] === "mouse" && fields.includes("rightbuttondown")
}

export function parseJitbitFile(text: string): JitbitFileParse {
  const rawLines = text.split(/\r?\n/)
  const steps: SkillStep[] = []
  const rightButtonDownRows: number[] = []

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim()
    if (!line) continue

    if (/^DELAY\s*:\s*(\d+)/i.test(line)) {
      const ms = line.match(/^DELAY\s*:\s*(\d+)/i)![1]
      steps.push({ id: crypto.randomUUID(), type: "delay", ms })
      continue
    }

    const kbdMatch = line.match(/^Keyboard\s*:\s*([A-Za-z0-9]+)\s*:\s*(KeyDown|KeyUp)/i)
    if (kbdMatch) {
      const key = normalizeKey(kbdMatch[1])
      if (key) {
        const action = kbdMatch[2].toLowerCase() === "keydown" ? "keydown" : "keyup"
        steps.push({ id: crypto.randomUUID(), type: action, key })
      }
      continue
    }

    // Tolerated candidate — position/count are validated after the pass.
    if (isRightButtonDownRow(line)) {
      rightButtonDownRows.push(i)
      continue
    }

    return {
      rejected: {
        line: i + 1,
        text: line,
        reason: "only keyboard rows (DELAY / Keyboard) are supported",
      },
    }
  }

  if (rightButtonDownRows.length > 0) {
    let firstNonBlank = -1
    let lastNonBlank = -1
    for (let i = 0; i < rawLines.length; i++) {
      if (rawLines[i].trim() !== "") {
        if (firstNonBlank === -1) firstNonBlank = i
        lastNonBlank = i
      }
    }

    const [first, second] = rightButtonDownRows
    const atBoundary = first === firstNonBlank || first === lastNonBlank
    if (rightButtonDownRows.length > 1 || !atBoundary) {
      const bad = second ?? first
      return {
        rejected: {
          line: bad + 1,
          text: rawLines[bad].trim(),
          reason:
            "right-button-down is only tolerated once, at the very start or end of a keyboard macro",
        },
      }
    }
  }

  return { steps }
}

/** Build a combo from manual entry: keydowns with inter-key delays, a delay before the keyups, reverse-order keyups, and a final rest delay. */
export function parseCombo(keysInput: string, delaysInput: string): SkillStep[] {
  const keys = keysInput.split(",").map((k) => k.trim()).filter(Boolean)
  const delays = delaysInput.split(",").map((d) => d.trim()).filter(Boolean)

  if (keys.length === 0) return []

  const steps: SkillStep[] = []

  // KeyDown for each key with delay after (except last uses its own delay)
  for (let i = 0; i < keys.length; i++) {
    steps.push({ id: crypto.randomUUID(), type: "keydown", key: keys[i] })
    if (i < keys.length - 1 && delays[i]) {
      steps.push({ id: crypto.randomUUID(), type: "delay", ms: delays[i] })
    }
  }

  // Delay between last keydown and keyups
  if (delays[keys.length - 1]) {
    steps.push({ id: crypto.randomUUID(), type: "delay", ms: delays[keys.length - 1] })
  }

  // KeyUp for all keys in reverse order
  for (let i = keys.length - 1; i >= 0; i--) {
    steps.push({ id: crypto.randomUUID(), type: "keyup", key: keys[i] })
  }

  // Final rest delay
  if (delays[keys.length]) {
    steps.push({ id: crypto.randomUUID(), type: "delay", ms: delays[keys.length] })
  }

  return steps
}
