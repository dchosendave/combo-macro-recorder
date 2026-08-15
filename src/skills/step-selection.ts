import type { SkillStep } from "@/shared/types"

export function copySelectedSteps(steps: SkillStep[], selectedIds: Set<string>): SkillStep[] {
  return steps.filter((step) => selectedIds.has(step.id)).map((step) => ({ ...step }))
}

export function pasteSkillSteps(
  steps: SkillStep[],
  copiedSteps: SkillStep[],
  selectedIds: Set<string>,
) {
  if (copiedSteps.length === 0) return { steps, selectedIds }
  const copies = copiedSteps.map((step) => ({ ...step, id: crypto.randomUUID() }))
  const selectedIndexes = steps
    .map((step, index) => selectedIds.has(step.id) ? index : -1)
    .filter((index) => index >= 0)
  const insertionIndex = selectedIndexes.length > 0 ? Math.max(...selectedIndexes) + 1 : steps.length
  const next = [...steps]
  next.splice(insertionIndex, 0, ...copies)
  return { steps: next, selectedIds: new Set(copies.map((step) => step.id)) }
}

export function duplicateSelectedSteps(steps: SkillStep[], selectedIds: Set<string>) {
  const selected = steps.filter((step) => selectedIds.has(step.id))
  if (selected.length === 0) return { steps, selectedIds }
  const last = Math.max(...selected.map((step) => steps.indexOf(step)))
  const copies = selected.map((step) => ({ ...step, id: crypto.randomUUID() }))
  const next = [...steps]
  next.splice(last + 1, 0, ...copies)
  return { steps: next, selectedIds: new Set(copies.map((step) => step.id)) }
}

export function reorderSelectedSteps(
  steps: SkillStep[],
  selectedIds: Set<string>,
  toId: string,
  position: "above" | "below",
) {
  if (selectedIds.has(toId) || selectedIds.size === 0) return steps
  const moved = steps.filter((step) => selectedIds.has(step.id))
  const next = steps.filter((step) => !selectedIds.has(step.id))
  const target = next.findIndex((step) => step.id === toId)
  if (target < 0) return steps
  next.splice(position === "below" ? target + 1 : target, 0, ...moved)
  return next
}

export function adjustSelectedDelays(
  steps: SkillStep[],
  selectedIds: Set<string>,
  amount: number,
  operation: "set" | "add" | "subtract",
) {
  const safeAmount = Math.max(0, amount || 0)
  return steps.map((step) => {
    if (!selectedIds.has(step.id) || step.type !== "delay") return step
    const current = Math.max(0, Number(step.ms) || 0)
    const next = operation === "set"
      ? safeAmount
      : operation === "add"
        ? current + safeAmount
        : Math.max(0, current - safeAmount)
    return { ...step, ms: String(next) }
  })
}

export function setSelectedStepsDisabled(
  steps: SkillStep[],
  selectedIds: Set<string>,
  disabled: boolean,
) {
  return steps.map((step) => selectedIds.has(step.id) ? { ...step, disabled } : step)
}
