import { describe, it, expect } from "vitest"
import { formatElapsed } from "./format"

describe("formatElapsed", () => {
  it("formats sub-minute durations as plain seconds", () => {
    expect(formatElapsed(0)).toBe("0s")
    expect(formatElapsed(1)).toBe("1s")
    expect(formatElapsed(59)).toBe("59s")
  })

  it("formats minute durations as m ss", () => {
    expect(formatElapsed(60)).toBe("1m 00s")
    expect(formatElapsed(65)).toBe("1m 05s")
    expect(formatElapsed(600)).toBe("10m 00s")
    expect(formatElapsed(3600)).toBe("60m 00s")
  })
})
