import { derivePotionRun, deriveSkillRun } from "@/shared/run-validation"
import type { PotionsRunConfig, SkillsRunConfig } from "@/shared/run-validation"
import type { CurrentCombo } from "@/shared/types"

export type { PotionsRunConfig, SkillsRunConfig, SkillStepRunConfig } from "@/shared/run-validation"

export type RunnerInputs = {
  potionsConfig: PotionsRunConfig
  potionsCanRun: boolean
  skillsConfig: SkillsRunConfig
  skillsCanRun: boolean
}

/**
 * Derives the backend run configs + "can run" gates from a combo.
 * Delegates to the shared derivations (`src/shared/run-validation.ts`) — the
 * same single source the live tabs use — so a file-loaded combo behaves
 * identically to one edited in the tabs.
 */
export function toRunnerInputs(combo: CurrentCombo): RunnerInputs {
  const potions = derivePotionRun(combo.potions)
  const skills = deriveSkillRun(combo.skills)
  return {
    potionsConfig: potions.config,
    potionsCanRun: potions.canRun,
    skillsConfig: skills.config,
    skillsCanRun: skills.canRun,
  }
}
