import { act, renderHook } from "@testing-library/react"
import { describe, it, expect, beforeEach } from "vitest"
import { invokeMock } from "@/test/tauri-utils"
import { useComboFiles } from "@/combo-file/use-combo-files"

const COMBO_DIR_KEY = "combo-macro-combo-dir"
const DIR = "C:\\combos"
const FILES = [
  { name: "a.json", path: "C:\\combos\\a.json" },
  { name: "b.json", path: "C:\\combos\\b.json" },
]

describe("useComboFiles", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("stays empty and does not invoke when no combo dir is set", async () => {
    const { result } = renderHook(() => useComboFiles())
    await act(async () => {})

    expect(invokeMock).not.toHaveBeenCalled()
    expect(result.current.comboFiles).toEqual([])
  })

  it("loads combo files from the stored combo dir on mount", async () => {
    localStorage.setItem(COMBO_DIR_KEY, DIR)
    invokeMock.mockResolvedValue(FILES)

    const { result } = renderHook(() => useComboFiles())
    await act(async () => {})

    expect(invokeMock).toHaveBeenCalledWith("list_combo_files", { path: DIR })
    expect(result.current.comboFiles).toEqual(FILES)
  })

  it("clears the list when the listing fails", async () => {
    localStorage.setItem(COMBO_DIR_KEY, DIR)
    invokeMock.mockRejectedValue(new Error("missing"))

    const { result } = renderHook(() => useComboFiles())
    await act(async () => {})

    expect(result.current.comboFiles).toEqual([])
  })

  it("refreshComboFiles picks up a newly set combo dir", async () => {
    const { result } = renderHook(() => useComboFiles())
    await act(async () => {})

    localStorage.setItem(COMBO_DIR_KEY, DIR)
    invokeMock.mockResolvedValue(FILES)

    await act(async () => {
      await result.current.refreshComboFiles()
    })

    expect(invokeMock).toHaveBeenCalledWith("list_combo_files", { path: DIR })
    expect(result.current.comboFiles).toEqual(FILES)
  })
})
