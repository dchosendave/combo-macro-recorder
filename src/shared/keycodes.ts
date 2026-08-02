const MODIFIER_SET = new Set(["Control", "Alt", "Shift", "Meta"])

function resolveShortcutCode(code: string): string {
  if (/^F\d{1,2}$/.test(code)) return code

  if (code.startsWith("Key")) return code.slice(3)
  if (code.startsWith("Digit")) return code.slice(5)
  if (code.startsWith("Numpad")) return code.slice(6)

  const codeNames: Record<string, string> = {
    ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right",
    Backquote: "Backquote", Backslash: "Backslash",
    BracketLeft: "BracketLeft", BracketRight: "BracketRight",
    Comma: "Comma", Period: "Period", Slash: "Slash",
    Semicolon: "Semicolon", Quote: "Quote",
    Minus: "Minus", Equal: "Equal",
    Space: "Space", Tab: "Tab", Enter: "Enter",
    Backspace: "Backspace", Delete: "Delete", Escape: "Escape",
    Home: "Home", End: "End",
    PageUp: "PageUp", PageDown: "PageDown",
    Insert: "Insert", CapsLock: "CapsLock",
  }

  return codeNames[code] ?? code
}

/** Normalize a captured `KeyboardEvent.code` (e.g. `KeyQ`, `Digit1`, `Numpad0`, `Control+F5`) into a shortcut string the Rust global-shortcut plugin accepts. */
export function codeToShortcut(code: string): string {
  return code.split("+").map((token) => {
    if (MODIFIER_SET.has(token)) return token
    return resolveShortcutCode(token)
  }).join("+")
}

function resolveLabelCode(code: string): string {
  if (/^F\d{1,2}$/.test(code)) return code
  if (code.startsWith("Key")) return code.slice(3)
  if (code.startsWith("Digit")) return code.slice(5)
  if (code.startsWith("Numpad")) return `Num${code.slice(6)}`

  const labels: Record<string, string> = {
    ArrowUp: "\u2191", ArrowDown: "\u2193", ArrowLeft: "\u2190", ArrowRight: "\u2192",
    Backquote: "`", Backslash: "\\",
    BracketLeft: "[", BracketRight: "]",
    Comma: ",", Period: ".", Slash: "/",
    Semicolon: ";", Quote: "'",
    Minus: "-", Equal: "=",
    Space: "Space", Tab: "Tab", Enter: "Enter",
    Backspace: "\u232b", Delete: "Del", Escape: "Esc",
    Home: "Home", End: "End",
    PageUp: "PgUp", PageDown: "PgDn",
    Insert: "Ins", CapsLock: "Caps",
  }

  return labels[code] ?? code
}

const MODIFIER_LABELS: Record<string, string> = {
  Control: "Ctrl",
  Alt: "Alt",
  Shift: "Shift",
  Meta: "Cmd",
}

/** Render a shortcut string (e.g. `Control+F5`) as a compact UI label (e.g. `Ctrl+F5`). */
export function codeToLabel(code: string): string {
  return code.split("+").map((token) => MODIFIER_LABELS[token] ?? resolveLabelCode(token)).join("+")
}
