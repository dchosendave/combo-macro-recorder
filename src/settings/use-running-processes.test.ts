import { describe, it, expect, beforeEach } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { invokeMock, toastMock } from "@/test/tauri-utils"
import { useRunningProcesses } from "./use-running-processes"

const PROCESSES = [
  { pid: 1, name: "main.exe", title: "MU Online", friendly: "MU Online Client" },
  { pid: 2, name: "chrome.exe", title: null, friendly: "Google Chrome" },
]

beforeEach(() => {
  invokeMock.mockResolvedValue(undefined)
})

describe("useRunningProcesses", () => {
  it("loads the process snapshot on refresh", async () => {
    invokeMock.mockResolvedValue(PROCESSES)
    const { result } = renderHook(() => useRunningProcesses())

    await act(async () => {
      await result.current.refresh()
    })

    expect(invokeMock).toHaveBeenCalledWith("list_processes")
    expect(result.current.processes).toEqual(PROCESSES)
    expect(result.current.loading).toBe(false)
  })

  it("toasts and keeps the previous list when refresh fails", async () => {
    invokeMock.mockResolvedValueOnce(PROCESSES)
    const { result } = renderHook(() => useRunningProcesses())
    await act(async () => {
      await result.current.refresh()
    })

    invokeMock.mockRejectedValueOnce(new Error("boom"))
    await act(async () => {
      await result.current.refresh()
    })

    expect(toastMock.error).toHaveBeenCalledWith("Failed to list processes: Error: boom")
    expect(result.current.processes).toEqual(PROCESSES)
    expect(result.current.loading).toBe(false)
  })
})
