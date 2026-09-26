import { act, renderHook } from "@testing-library/react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { beforeEach, expect, it, vi } from "vitest"
import { invokeMock } from "@/test/tauri-utils"
import { useCloseGuard } from "./use-close-guard"

beforeEach(() => { invokeMock.mockResolvedValue(undefined) })

it("protects native close, allows confirmed discard once, and blocks close during saving", async () => {
  let onClose!: (event: { preventDefault: () => void }) => void
  const prevented = vi.fn()
  const close = vi.fn(async () => { onClose({ preventDefault: prevented }) })
  vi.mocked(getCurrentWindow).mockReturnValue({
    close,
    onCloseRequested: vi.fn(async (handler) => { onClose = handler; return vi.fn() }),
  } as never)
  const hook = renderHook(({ dirty, busy }) => useCloseGuard(dirty, busy), { initialProps: { dirty: true, busy: false } })
  await act(async () => { await close() }) // Alt+F4/taskbar native event
  expect(prevented).toHaveBeenCalledTimes(1)
  expect(hook.result.current.showCloseConfirm).toBe(true)
  await act(async () => { hook.result.current.confirmClose() })
  expect(prevented).toHaveBeenCalledTimes(1)
  await act(async () => { await close() })
  expect(prevented).toHaveBeenCalledTimes(2)
  hook.rerender({ dirty: false, busy: true })
  await act(async () => { await close() })
  expect(prevented).toHaveBeenCalledTimes(3)
  hook.rerender({ dirty: true, busy: false })
  close.mockRejectedValueOnce(new Error("window operation failed"))
  await act(async () => { hook.result.current.confirmClose() })
  await act(async () => { await close() })
  expect(prevented).toHaveBeenCalledTimes(4)
})
