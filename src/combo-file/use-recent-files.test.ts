import { act, renderHook } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { MAX_RECENT_FILES, RECENT_FILES_KEY } from "@/shared/persistence"
import { useRecentFiles } from "@/combo-file/use-recent-files"

describe("useRecentFiles", () => {
  it("loads persisted paths into the initial state", () => {
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(["a.json", "b.json"]))
    const { result } = renderHook(() => useRecentFiles())
    expect(result.current.recentFiles).toEqual(["a.json", "b.json"])
  })

  it("starts empty when nothing is persisted", () => {
    const { result } = renderHook(() => useRecentFiles())
    expect(result.current.recentFiles).toEqual([])
  })

  it("addRecent prepends, persists, and dedupes", async () => {
    const { result } = renderHook(() => useRecentFiles())
    await act(async () => {
      result.current.addRecent("a.json")
    })
    await act(async () => {
      result.current.addRecent("b.json")
    })
    await act(async () => {
      result.current.addRecent("a.json")
    })
    expect(result.current.recentFiles).toEqual(["a.json", "b.json"])
    expect(JSON.parse(localStorage.getItem(RECENT_FILES_KEY) ?? "null")).toEqual([
      "a.json",
      "b.json",
    ])
  })

  it("addRecent caps the list at MAX_RECENT_FILES", async () => {
    const { result } = renderHook(() => useRecentFiles())
    for (let i = 0; i < 10; i++) {
      const path = `c${i}.json`
      await act(async () => {
        result.current.addRecent(path)
      })
    }
    expect(result.current.recentFiles).toHaveLength(MAX_RECENT_FILES)
    expect(result.current.recentFiles[0]).toBe("c9.json")
    expect(result.current.recentFiles).not.toContain("c0.json")
  })

  it("removeRecent drops one entry and persists", async () => {
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(["a.json", "b.json", "c.json"]))
    const { result } = renderHook(() => useRecentFiles())
    await act(async () => {
      result.current.removeRecent("b.json")
    })
    expect(result.current.recentFiles).toEqual(["a.json", "c.json"])
    expect(JSON.parse(localStorage.getItem(RECENT_FILES_KEY) ?? "null")).toEqual([
      "a.json",
      "c.json",
    ])
  })

  it("clearRecent empties state and removes the key", async () => {
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(["a.json"]))
    const { result } = renderHook(() => useRecentFiles())
    await act(async () => {
      result.current.clearRecent()
    })
    expect(result.current.recentFiles).toEqual([])
    expect(localStorage.getItem(RECENT_FILES_KEY)).toBeNull()
  })
})
