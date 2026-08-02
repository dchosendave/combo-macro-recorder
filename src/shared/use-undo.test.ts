import { describe, it, expect } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useUndo } from "./use-undo"

describe("useUndo", () => {
  it("exposes the initial value with no history", () => {
    const { result } = renderHook(() => useUndo(0))
    expect(result.current.value).toBe(0)
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it("pushes history on setValue and undoes back through it", () => {
    const { result } = renderHook(() => useUndo(0))
    act(() => result.current.setValue(1))
    act(() => result.current.setValue(2))
    expect(result.current.value).toBe(2)
    expect(result.current.canUndo).toBe(true)
    expect(result.current.canRedo).toBe(false)

    act(() => result.current.undo())
    expect(result.current.value).toBe(1)
    expect(result.current.canUndo).toBe(true)
    expect(result.current.canRedo).toBe(true)

    act(() => result.current.undo())
    expect(result.current.value).toBe(0)
    expect(result.current.canUndo).toBe(false)
  })

  it("redoes forward and clears the future on a new setValue", () => {
    const { result } = renderHook(() => useUndo(0))
    act(() => result.current.setValue(1))
    act(() => result.current.undo())
    expect(result.current.value).toBe(0)
    expect(result.current.canRedo).toBe(true)

    act(() => result.current.redo())
    expect(result.current.value).toBe(1)
    expect(result.current.canRedo).toBe(false)
    expect(result.current.canUndo).toBe(true)

    act(() => result.current.undo())
    act(() => result.current.setValue(9))
    expect(result.current.value).toBe(9)
    expect(result.current.canRedo).toBe(false)
  })

  it("supports the functional setValue form", () => {
    const { result } = renderHook(() => useUndo(5))
    act(() => result.current.setValue((prev) => prev + 1))
    expect(result.current.value).toBe(6)
    act(() => result.current.undo())
    expect(result.current.value).toBe(5)
  })

  it("caps history near MAX_HISTORY (50)", () => {
    const { result } = renderHook(() => useUndo(0))
    for (let i = 1; i <= 55; i++) {
      act(() => result.current.setValue(i))
    }
    expect(result.current.value).toBe(55)

    // `past` keeps `slice(-50)` then appends the current state, so 55 pushes
    // leave 51 entries — the 50th undo lands on state 5 with one entry left.
    for (let i = 0; i < 50; i++) {
      act(() => result.current.undo())
    }
    expect(result.current.value).toBe(5)
    expect(result.current.canUndo).toBe(true)

    act(() => result.current.undo())
    expect(result.current.value).toBe(4)
    expect(result.current.canUndo).toBe(false)
  })
})
