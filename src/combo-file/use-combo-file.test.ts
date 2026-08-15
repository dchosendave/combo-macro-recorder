import { act, renderHook } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { open, save } from "@tauri-apps/plugin-dialog"
import { invokeMock, toastMock } from "@/test/tauri-utils"
import { exportComboToString } from "@/combo-file/combo-io"
import { defaultPotionConfig, defaultSkillConfig } from "@/shared/defaults"
import type { CurrentCombo } from "@/shared/types"
import { useComboFile } from "@/combo-file/use-combo-file"

const LAST_PATH_KEY = "combo-macro-last-path"
const AUTO_LOAD_KEY = "combo-macro-auto-load"
const PATH = "C:\\combos\\a.json"

const openMock = vi.mocked(open)
const saveMock = vi.mocked(save)

const OPENED_CONTENT = exportComboToString({
  potions: { ...defaultPotionConfig(), customDelay: true, delayMs: "150" },
  skills: defaultSkillConfig(),
})

function setup(overrides: Partial<Parameters<typeof useComboFile>[0]> = {}) {
  const combo: CurrentCombo = { potions: defaultPotionConfig(), skills: defaultSkillConfig() }
  const applyCombo = vi.fn()
  const onSave = vi.fn()
  const makeProps = () => ({ getCombo: () => combo, applyCombo, onSave, ...overrides })
  const hook = renderHook((props: Parameters<typeof useComboFile>[0]) => useComboFile(props), {
    initialProps: makeProps(),
  })
  // A fresh props object gives `getCombo` a new identity so the isDirty memo recomputes.
  const rerender = () => hook.rerender(makeProps())
  return { combo, applyCombo, onSave, hook, rerender }
}

beforeEach(() => {
  invokeMock.mockResolvedValue(undefined)
})

describe("useComboFile", () => {
  it("tracks dirtiness against a baseline and clears it on save", async () => {
    const { combo, applyCombo, onSave, hook, rerender } = setup()
    expect(hook.result.current.isDirty).toBe(false)

    combo.potions.delayMs = "200"
    rerender()
    expect(hook.result.current.isDirty).toBe(true)

    saveMock.mockResolvedValue(PATH)
    await act(async () => {
      await hook.result.current.saveFile()
    })

    expect(saveMock).toHaveBeenCalledWith({
      defaultPath: "combo.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    })
    expect(invokeMock).toHaveBeenCalledWith("save_file", {
      path: PATH,
      content: exportComboToString(combo),
    })
    expect(onSave).toHaveBeenCalledWith(PATH)
    expect(hook.result.current.isDirty).toBe(false)
    expect(hook.result.current.lastSavedAt).toEqual(expect.any(Number))

    // Baseline is the saved string: the same content is not dirty on re-render.
    rerender()
    expect(hook.result.current.isDirty).toBe(false)
    expect(applyCombo).not.toHaveBeenCalled()
  })

  it("requestOpen while dirty defers the dialog until discard is confirmed or cancelled", () => {
    const { combo, hook, rerender } = setup()
    combo.potions.delayMs = "200"
    rerender()

    act(() => {
      hook.result.current.requestOpen()
    })
    expect(hook.result.current.pendingAction).toEqual({ type: "open" })
    expect(openMock).not.toHaveBeenCalled()

    act(() => {
      hook.result.current.cancelDiscard()
    })
    expect(hook.result.current.pendingAction).toBeNull()
    expect(openMock).not.toHaveBeenCalled()
  })

  it("confirmDiscard after a dirty requestOpen proceeds with the dialog and loads the file", async () => {
    const { combo, applyCombo, hook, rerender } = setup()
    combo.potions.delayMs = "200"
    rerender()

    act(() => {
      hook.result.current.requestOpen()
    })
    openMock.mockResolvedValue(PATH)
    invokeMock.mockResolvedValueOnce(OPENED_CONTENT)

    await act(async () => {
      hook.result.current.confirmDiscard()
    })

    expect(openMock).toHaveBeenCalledWith({
      filters: [{ name: "JSON", extensions: ["json"] }],
      multiple: false,
    })
    expect(applyCombo).toHaveBeenCalledWith(
      expect.objectContaining({
        potions: expect.objectContaining({ customDelay: true, delayMs: "150" }),
      }),
    )
    expect(hook.result.current.currentFilePath).toBe(PATH)
    expect(hook.result.current.pendingAction).toBeNull()
    expect(hook.result.current.isProcessing).toBe(false)
    expect(localStorage.getItem(LAST_PATH_KEY)).toBe(PATH)
    expect(toastMock.success).toHaveBeenCalledWith("Opened a.json")
  })

  it("requestOpen while clean opens the dialog immediately and applies the loaded combo", async () => {
    const { applyCombo, hook } = setup()
    openMock.mockResolvedValue(PATH)
    invokeMock.mockResolvedValueOnce(OPENED_CONTENT)

    await act(async () => {
      hook.result.current.requestOpen()
    })

    expect(openMock).toHaveBeenCalledWith({
      filters: [{ name: "JSON", extensions: ["json"] }],
      multiple: false,
    })
    expect(invokeMock).toHaveBeenCalledWith("read_file", { path: PATH })
    expect(applyCombo).toHaveBeenCalledWith(
      expect.objectContaining({
        potions: expect.objectContaining({ customDelay: true, delayMs: "150" }),
      }),
    )
    expect(hook.result.current.currentFilePath).toBe(PATH)
    expect(localStorage.getItem(LAST_PATH_KEY)).toBe(PATH)
  })

  it("cancelling the open dialog does not read a file and resets processing", async () => {
    const { applyCombo, hook } = setup()
    openMock.mockResolvedValue(null)

    await act(async () => {
      hook.result.current.requestOpen()
    })

    expect(openMock).toHaveBeenCalled()
    expect(invokeMock).not.toHaveBeenCalled()
    expect(applyCombo).not.toHaveBeenCalled()
    expect(hook.result.current.isProcessing).toBe(false)
    expect(hook.result.current.currentFilePath).toBeNull()
  })

  it("a read failure toasts an error and resets processing", async () => {
    const { applyCombo, hook } = setup()
    openMock.mockResolvedValue(PATH)
    invokeMock.mockRejectedValueOnce(new Error("boom"))

    await act(async () => {
      hook.result.current.requestOpen()
    })

    expect(toastMock.error).toHaveBeenCalledWith(expect.stringContaining("Open failed"))
    expect(applyCombo).not.toHaveBeenCalled()
    expect(hook.result.current.isProcessing).toBe(false)
    expect(hook.result.current.currentFilePath).toBeNull()
  })

  it("offers and restores a valid backup when the primary combo is damaged", async () => {
    const onOpened = vi.fn()
    const { applyCombo, hook } = setup({ onOpened })
    invokeMock
      .mockResolvedValueOnce("damaged")
      .mockResolvedValueOnce(OPENED_CONTENT)
      .mockResolvedValueOnce(undefined)

    await act(async () => {
      await hook.result.current.openPath(PATH)
    })

    expect(invokeMock).toHaveBeenNthCalledWith(2, "read_backup_file", { path: PATH })
    expect(hook.result.current.pendingRecovery).toEqual({
      path: PATH,
      combo: expect.objectContaining({ potions: expect.objectContaining({ delayMs: "150" }) }),
    })
    expect(applyCombo).not.toHaveBeenCalled()

    await act(async () => {
      await hook.result.current.confirmRecovery()
    })

    expect(invokeMock).toHaveBeenLastCalledWith("restore_backup_file", { path: PATH })
    expect(applyCombo).toHaveBeenCalled()
    expect(onOpened).toHaveBeenCalledWith(PATH)
    expect(hook.result.current.currentFilePath).toBe(PATH)
    expect(hook.result.current.pendingRecovery).toBeNull()
    expect(toastMock.success).toHaveBeenCalledWith("Recovered the previous saved version")
  })

  it("leaves a damaged combo untouched when recovery is cancelled", async () => {
    const { applyCombo, hook } = setup()
    invokeMock.mockResolvedValueOnce("damaged").mockResolvedValueOnce(OPENED_CONTENT)

    await act(async () => {
      await hook.result.current.openPath(PATH)
    })
    act(() => hook.result.current.cancelRecovery())

    expect(hook.result.current.pendingRecovery).toBeNull()
    expect(applyCombo).not.toHaveBeenCalled()
    expect(invokeMock).not.toHaveBeenCalledWith("restore_backup_file", expect.anything())
  })

  it("Ctrl+S saves to the current path when one is set", async () => {
    const { combo, onSave, hook } = setup()
    openMock.mockResolvedValue(PATH)
    invokeMock.mockResolvedValueOnce(OPENED_CONTENT)
    await act(async () => {
      await hook.result.current.openFile()
    })
    invokeMock.mockClear()

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true }))
    })

    expect(saveMock).not.toHaveBeenCalled()
    expect(invokeMock).toHaveBeenCalledWith("save_file", {
      path: PATH,
      content: exportComboToString(combo),
    })
    expect(onSave).toHaveBeenCalledWith(PATH)
    expect(toastMock.success).toHaveBeenCalledWith("Saved")
  })

  it("Ctrl+S without a current path shows the save dialog", async () => {
    const { combo } = setup()
    saveMock.mockResolvedValue(PATH)

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true }))
    })

    expect(saveMock).toHaveBeenCalledWith({
      defaultPath: "combo.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    })
    expect(invokeMock).toHaveBeenCalledWith("save_file", {
      path: PATH,
      content: exportComboToString(combo),
    })
  })

  it("Meta+S also triggers a save (the guard accepts ctrlKey or metaKey)", async () => {
    setup()
    saveMock.mockResolvedValue(PATH)

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", metaKey: true }))
    })

    expect(saveMock).toHaveBeenCalled()
  })

  it("a plain s keydown without a modifier does not trigger a save", async () => {
    setup()

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "s" }))
    })

    expect(saveMock).not.toHaveBeenCalled()
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("tryAutoLoad loads the last path when auto-load is enabled", async () => {
    const { applyCombo, hook } = setup()
    localStorage.setItem(LAST_PATH_KEY, PATH)
    invokeMock.mockResolvedValueOnce(OPENED_CONTENT)

    let loaded = false
    await act(async () => {
      loaded = await hook.result.current.tryAutoLoad()
    })

    expect(loaded).toBe(true)
    expect(invokeMock).toHaveBeenCalledWith("read_file", { path: PATH })
    expect(applyCombo).toHaveBeenCalledWith(
      expect.objectContaining({
        potions: expect.objectContaining({ customDelay: true, delayMs: "150" }),
      }),
    )
    expect(hook.result.current.currentFilePath).toBe(PATH)
  })

  it("tryAutoLoad skips loading when auto-load is disabled", async () => {
    const { applyCombo, hook } = setup()
    localStorage.setItem(LAST_PATH_KEY, PATH)
    localStorage.setItem(AUTO_LOAD_KEY, "false")

    let loaded = true
    await act(async () => {
      loaded = await hook.result.current.tryAutoLoad()
    })

    expect(loaded).toBe(false)
    expect(invokeMock).not.toHaveBeenCalled()
    expect(applyCombo).not.toHaveBeenCalled()
  })

  it("tryAutoLoad returns false when no last path is stored", async () => {
    const { hook } = setup()

    let loaded = true
    await act(async () => {
      loaded = await hook.result.current.tryAutoLoad()
    })

    expect(loaded).toBe(false)
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("openPath reads and applies the file at the given path", async () => {
    const onOpened = vi.fn()
    const { applyCombo, hook } = setup({ onOpened })
    invokeMock.mockResolvedValueOnce(OPENED_CONTENT)

    let ok: boolean | null = null
    await act(async () => {
      ok = await hook.result.current.openPath(PATH)
    })

    expect(ok).toBe(true)
    expect(openMock).not.toHaveBeenCalled()
    expect(invokeMock).toHaveBeenCalledWith("read_file", { path: PATH })
    expect(applyCombo).toHaveBeenCalledWith(
      expect.objectContaining({
        potions: expect.objectContaining({ customDelay: true, delayMs: "150" }),
      }),
    )
    expect(hook.result.current.currentFilePath).toBe(PATH)
    expect(localStorage.getItem(LAST_PATH_KEY)).toBe(PATH)
    expect(onOpened).toHaveBeenCalledWith(PATH)
    expect(toastMock.success).toHaveBeenCalledWith("Opened a.json")
    expect(hook.result.current.isProcessing).toBe(false)
  })

  it("openPath failure toasts an error, reports onOpenFailed, and keeps the current file", async () => {
    const onOpenFailed = vi.fn()
    const { applyCombo, hook } = setup({ onOpenFailed })
    invokeMock.mockRejectedValueOnce(new Error("missing"))

    let ok: boolean | null = null
    await act(async () => {
      ok = await hook.result.current.openPath(PATH)
    })

    expect(ok).toBe(false)
    expect(toastMock.error).toHaveBeenCalledWith(expect.stringContaining("Open failed"))
    expect(onOpenFailed).toHaveBeenCalledWith(PATH)
    expect(applyCombo).not.toHaveBeenCalled()
    expect(hook.result.current.currentFilePath).toBeNull()
    expect(hook.result.current.isProcessing).toBe(false)
  })

  it("requestOpenPath opens the path immediately when clean", async () => {
    const { applyCombo, hook } = setup()
    invokeMock.mockResolvedValueOnce(OPENED_CONTENT)

    await act(async () => {
      hook.result.current.requestOpenPath(PATH)
    })

    expect(openMock).not.toHaveBeenCalled()
    expect(invokeMock).toHaveBeenCalledWith("read_file", { path: PATH })
    expect(applyCombo).toHaveBeenCalled()
    expect(hook.result.current.currentFilePath).toBe(PATH)
  })

  it("requestOpenPath while dirty defers until discard is confirmed", async () => {
    const { combo, hook, rerender } = setup()
    combo.potions.delayMs = "200"
    rerender()

    act(() => {
      hook.result.current.requestOpenPath(PATH)
    })
    expect(hook.result.current.pendingAction).toEqual({ type: "open", path: PATH })
    expect(openMock).not.toHaveBeenCalled()
    expect(invokeMock).not.toHaveBeenCalled()

    invokeMock.mockResolvedValueOnce(OPENED_CONTENT)
    await act(async () => {
      hook.result.current.confirmDiscard()
    })

    expect(openMock).not.toHaveBeenCalled()
    expect(invokeMock).toHaveBeenCalledWith("read_file", { path: PATH })
    expect(hook.result.current.currentFilePath).toBe(PATH)
    expect(hook.result.current.pendingAction).toBeNull()
  })

  it("cancelling discard after requestOpenPath does not open the path", async () => {
    const { combo, hook, rerender } = setup()
    combo.potions.delayMs = "200"
    rerender()

    act(() => {
      hook.result.current.requestOpenPath(PATH)
    })
    act(() => {
      hook.result.current.cancelDiscard()
    })

    expect(hook.result.current.pendingAction).toBeNull()
    expect(openMock).not.toHaveBeenCalled()
    expect(invokeMock).not.toHaveBeenCalled()
    expect(hook.result.current.currentFilePath).toBeNull()
  })
})
