export function codeToShortcut(code: string): string {
  if (/^F(\d{1,2})$/.test(code)) return code

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

export function codeToLabel(code: string): string {
  if (code.startsWith("Key")) return code.slice(3)
  if (code.startsWith("Digit")) return code.slice(5)
  if (code.startsWith("Numpad")) return `Num${code.slice(6)}`

  const labels: Record<string, string> = {
    ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
    Backquote: "`", Backslash: "\\",
    BracketLeft: "[", BracketRight: "]",
    Comma: ",", Period: ".", Slash: "/",
    Semicolon: ";", Quote: "'",
    Minus: "-", Equal: "=",
    Space: "Space", Tab: "Tab", Enter: "Enter",
    Backspace: "⌫", Delete: "Del", Escape: "Esc",
    Home: "Home", End: "End",
    PageUp: "PgUp", PageDown: "PgDn",
    Insert: "Ins", CapsLock: "Caps",
  }

  return labels[code] ?? code
}
