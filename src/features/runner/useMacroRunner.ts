import { useCallback, useEffect, useRef, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { toast } from "sonner"
import type {
  PotionsRunConfig,
  RunnerInputs,
  SkillsRunConfig,
} from "@/features/runner/lib/runnerInputs"

type UseMacroRunnerArgs = {
  potionsCanRun: boolean
  potionsConfig: PotionsRunConfig
  skillsCanRun: boolean
  skillsConfig: SkillsRunConfig
  onStart?: () => void
  onStop?: () => void
}

export function useMacroRunner({
  potionsCanRun,
  potionsConfig,
  skillsCanRun,
  skillsConfig,
  onStart,
  onStop,
}: UseMacroRunnerArgs) {
  const [potionsRunning, setPotionsRunning] = useState(false)
  const [skillsRunning, setSkillsRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [potionsCycles, setPotionsCycles] = useState(0)
  const [skillsCycles, setSkillsCycles] = useState(0)

  const anyRunning = potionsRunning || skillsRunning

  const potionsRunningRef = useRef(potionsRunning)
  potionsRunningRef.current = potionsRunning
  const skillsRunningRef = useRef(skillsRunning)
  skillsRunningRef.current = skillsRunning

  const potionsCanRunRef = useRef(potionsCanRun)
  potionsCanRunRef.current = potionsCanRun
  const skillsCanRunRef = useRef(skillsCanRun)
  skillsCanRunRef.current = skillsCanRun

  const potionsConfigRef = useRef(potionsConfig)
  potionsConfigRef.current = potionsConfig
  const skillsConfigRef = useRef(skillsConfig)
  skillsConfigRef.current = skillsConfig

  const onStartRef = useRef(onStart)
  onStartRef.current = onStart
  const onStopRef = useRef(onStop)
  onStopRef.current = onStop

  // Starts an explicit combo atomically (stop both + start the enabled channels
  // in a single backend command). Does not depend on React state having
  // re-rendered, so it is safe to call right after loading a combo file.
  const startCombo = useCallback((inputs: RunnerInputs) => {
    const potions = inputs.potionsCanRun ? inputs.potionsConfig : null
    const skills = inputs.skillsCanRun ? inputs.skillsConfig : null

    if (!potions && !skills) {
      toast.warning("Enable at least one channel first")
      return
    }

    invoke("start_combo", { potions, skills })
    setPotionsRunning(!!potions)
    setSkillsRunning(!!skills)
    onStartRef.current?.()
  }, [])

  const stopAll = useCallback(() => {
    invoke("stop_all")
    setPotionsRunning(false)
    setSkillsRunning(false)
    onStopRef.current?.()
  }, [])

  // Toggle for the current UI combo (used by the on-screen STOP and by hotkeys
  // that have no combo file attached). The live config refs already reflect the
  // tabs, so there is no load race here.
  const toggleRunning = useCallback(() => {
    if (potionsRunningRef.current || skillsRunningRef.current) {
      stopAll()
      return
    }
    startCombo({
      potionsConfig: potionsConfigRef.current,
      potionsCanRun: potionsCanRunRef.current,
      skillsConfig: skillsConfigRef.current,
      skillsCanRun: skillsCanRunRef.current,
    })
  }, [startCombo, stopAll])

  useEffect(() => {
    if (!anyRunning) return
    setElapsed(0)
    setPotionsCycles(0)
    setSkillsCycles(0)
    const secondTick = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(secondTick)
  }, [anyRunning])

  useEffect(() => {
    const unlistenActivation = listen<{ channel: string; cycle: number }>(
      "macro-activation",
      (event) => {
        if (event.payload.channel === "potions") {
          setPotionsCycles(event.payload.cycle)
        } else if (event.payload.channel === "skills") {
          setSkillsCycles(event.payload.cycle)
        }
      },
    )

    const unlistenFinished = listen<{ channel: string }>(
      "macro-finished",
      (event) => {
        if (event.payload.channel === "potions") {
          setPotionsRunning(false)
        } else if (event.payload.channel === "skills") {
          setSkillsRunning(false)
        }

        if (
          (event.payload.channel === "potions" && !skillsRunningRef.current) ||
          (event.payload.channel === "skills" && !potionsRunningRef.current)
        ) {
          onStopRef.current?.()
        }
      },
    )

    return () => {
      unlistenActivation.then((fn) => fn())
      unlistenFinished.then((fn) => fn())
    }
  }, [])

  return {
    potionsRunning,
    skillsRunning,
    anyRunning,
    elapsed,
    potionsCycles,
    skillsCycles,
    totalCycles: potionsCycles + skillsCycles,
    toggleRunning,
    startCombo,
    stopAll,
  }
}
