import type { SkillStep } from "@/shared/lib/types"

export function parseJitbit(text: string): SkillStep[] {
  const steps: SkillStep[] = []
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

  for (const line of lines) {
    if (/^DELAY\s*:\s*(\d+)/i.test(line)) {
      const ms = line.match(/^DELAY\s*:\s*(\d+)/i)![1]
      steps.push({ id: crypto.randomUUID(), type: "delay", ms })
      continue
    }

    const kbdMatch = line.match(/^Keyboard\s*:\s*([A-Za-z0-9])\s*:\s*(KeyDown|KeyUp)/i)
    if (kbdMatch) {
      const key = kbdMatch[1]
      const action = kbdMatch[2].toLowerCase() === "keydown" ? "keydown" : "keyup"
      steps.push({ id: crypto.randomUUID(), type: action, key })
      continue
    }
  }

  return steps
}

export function parseCombo(keysInput: string, delaysInput: string): SkillStep[] {
  const keys = keysInput.split(",").map((k) => k.trim()).filter(Boolean)
  const delays = delaysInput.split(",").map((d) => d.trim()).filter(Boolean)

  if (keys.length === 0) return []

  const steps: SkillStep[] = []

  // KeyDown for each key with delay after (except last uses its own delay)
  for (let i = 0; i < keys.length; i++) {
    steps.push({ id: crypto.randomUUID(), type: "keydown", key: keys[i] })
    if (i < keys.length - 1 && delays[i]) {
      steps.push({ id: crypto.randomUUID(), type: "delay", ms: delays[i] })
    }
  }

  // Delay between last keydown and keyups
  if (delays[keys.length - 1]) {
    steps.push({ id: crypto.randomUUID(), type: "delay", ms: delays[keys.length - 1] })
  }

  // KeyUp for all keys in reverse order
  for (let i = keys.length - 1; i >= 0; i--) {
    steps.push({ id: crypto.randomUUID(), type: "keyup", key: keys[i] })
  }

  // Final rest delay
  if (delays[keys.length]) {
    steps.push({ id: crypto.randomUUID(), type: "delay", ms: delays[keys.length] })
  }

  return steps
}
