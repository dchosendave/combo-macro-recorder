import { act, renderHook } from "@testing-library/react"
import { describe, it, expect, beforeEach } from "vitest"
import { TUTORIAL_SEEN_KEY } from "@/shared/persistence"
import { useFirstRun } from "./use-first-run"

describe("useFirstRun", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("starts as first run when the tutorial flag is absent", () => {
    const { result } = renderHook(() => useFirstRun())
    expect(result.current.isFirstRun).toBe(true)
  })

  it("treats a corrupt flag as not seen", () => {
    localStorage.setItem(TUTORIAL_SEEN_KEY, "garbage")
    const { result } = renderHook(() => useFirstRun())
    expect(result.current.isFirstRun).toBe(true)
  })

  it("is not a first run once the flag is persisted", () => {
    localStorage.setItem(TUTORIAL_SEEN_KEY, "1")
    const { result } = renderHook(() => useFirstRun())
    expect(result.current.isFirstRun).toBe(false)
  })

  it("markTutorialSeen persists the flag and flips state", () => {
    const { result } = renderHook(() => useFirstRun())
    act(() => result.current.markTutorialSeen())
    expect(result.current.isFirstRun).toBe(false)
    expect(localStorage.getItem(TUTORIAL_SEEN_KEY)).toBe("1")
  })
})
