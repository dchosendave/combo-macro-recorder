import { describe, it, expect, beforeEach } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { invokeMock, toastMock } from "@/test/tauri-utils"
import { useRecorder } from "./use-recorder"
import type { RecordedEvent } from "./events-to-steps"
import type { SkillStep } from "@/shared/types"

/** Strips generated ids so assertions pin the observable step shape only. */
function stripIds(steps: SkillStep[]) {
  return steps.map((s) =>
    s.type === "delay" ? { type: s.type, ms: s.ms } : { type: s.type, key: s.key },
  )
}

const EVENTS: RecordedEvent[] = [
  { timestampMs: 0, key: "A", action: "keydown" },
  { timestampMs: 120, key: "B", action: "keyup" },
]

beforeEach(() => {
  invokeMock.mockResolvedValue(undefined)
})

describe("useRecorder", () => {
  it("startRecording invokes start_recording and flips isRecording", async () => {
    const { result } = renderHook(() => useRecorder())

    await act(async () => {
      await result.current.startRecording()
    })

    expect(invokeMock).toHaveBeenCalledWith("start_recording")
    expect(result.current.isRecording).toBe(true)
    expect(toastMock.info).toHaveBeenCalledWith("Recording... press your combo, then click Stop")
  })

  it("startRecording reports failure and stays stopped when invoke rejects", async () => {
    const { result } = renderHook(() => useRecorder())
    invokeMock.mockRejectedValueOnce(new Error("boom"))

    await act(async () => {
      await result.current.startRecording()
    })

    expect(result.current.isRecording).toBe(false)
    expect(toastMock.error).toHaveBeenCalledWith("Failed to start recording: Error: boom")
  })

  it("stopRecording converts recorded events into steps", async () => {
    const { result } = renderHook(() => useRecorder())
    invokeMock.mockResolvedValueOnce(EVENTS as never)

    let steps: SkillStep[] | null = null
    await act(async () => {
      steps = await result.current.stopRecording()
    })

    expect(invokeMock).toHaveBeenCalledWith("stop_recording")
    expect(steps).not.toBeNull()
    expect(stripIds(steps!)).toEqual([
      { type: "keydown", key: "A" },
      { type: "delay", ms: "120" },
      { type: "keyup", key: "B" },
    ])
    expect(toastMock.success).toHaveBeenCalledWith("Recorded 3 steps")
    expect(result.current.isRecording).toBe(false)
  })

  it("stopRecording with no events returns null and warns", async () => {
    const { result } = renderHook(() => useRecorder())
    invokeMock.mockResolvedValueOnce([] as never)

    let steps: SkillStep[] | null = null
    await act(async () => {
      steps = await result.current.stopRecording()
    })

    expect(steps).toBeNull()
    expect(toastMock.error).toHaveBeenCalledWith("No keys recorded")
    expect(result.current.isRecording).toBe(false)
  })

  it("stopRecording reports failure and returns null when invoke rejects", async () => {
    const { result } = renderHook(() => useRecorder())
    invokeMock.mockRejectedValueOnce(new Error("boom"))

    let steps: SkillStep[] | null = null
    await act(async () => {
      steps = await result.current.stopRecording()
    })

    expect(steps).toBeNull()
    expect(toastMock.error).toHaveBeenCalledWith("Failed to stop recording: Error: boom")
    expect(result.current.isRecording).toBe(false)
  })
})
