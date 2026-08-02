import { afterEach, beforeEach, vi } from "vitest"
import { cleanup } from "@testing-library/react"

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }))
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }))
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(),
  currentMonitor: vi.fn(),
  LogicalPosition: class { constructor(public x: number, public y: number) {} },
}))
vi.mock("@tauri-apps/api/dpi", () => ({
  // Accepts both `new LogicalSize(w, h)` and the Tauri `new LogicalSize(size)`
  // form used by use-compact-mode (`new LogicalSize(current)`).
  LogicalSize: class {
    width: number
    height: number
    constructor(width: unknown, height: unknown) {
      if (typeof width === "object" && width !== null && "width" in width && "height" in width) {
        this.width = Number(width.width)
        this.height = Number(width.height)
      } else {
        this.width = Number(width)
        this.height = Number(height)
      }
    }
  },
  PhysicalSize: class { constructor(public width: number, public height: number) {} },
  PhysicalPosition: class { constructor(public x: number, public y: number) {} },
}))
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(), save: vi.fn() }))

// Node ≥ 22 ships an experimental global `localStorage` that resolves to
// undefined unless --localstorage-file is passed. vitest's jsdom environment
// sees the key as already present on `globalThis` and skips overriding it, so
// rebind it to the jsdom window's real Storage — the semantics every
// persistence test relies on. (`window` aliases `globalThis` here, so grab the
// storage from vitest's exposed jsdom instance instead of recursing.)
const jsdomWindow = (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window
Object.defineProperty(globalThis, "localStorage", {
  value: jsdomWindow.localStorage,
  writable: true,
  configurable: true,
})
vi.mock("sonner", () => {
  // Callable (use-settings' `reset` invokes `toast(...)` directly) and has the
  // named helpers every other call site uses.
  const toast = Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  })
  return { toast }
})

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})
