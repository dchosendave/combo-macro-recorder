import { useCallback, useEffect, useRef, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { toast } from "sonner"
import type { PotionKey, RepeatMode } from "@/shared/lib/types"

type PotionsConfig = {
  keys: Record<PotionKey, boolean>
  delayMs: number
  repeatMode: RepeatMode
  repeatCount: number
}

type SkillStepConfig = {
  type: "keydown" | "keyup";
  key: string;
} | {
  type: "delay";
  ms: number;
};

type SkillsConfig = {
  holdRightClick: boolean
  steps: SkillStepConfig[]
  repeatMode: RepeatMode
  repeatCount: number
}

type UseMacroRunnerArgs = {
  potionsCanRun: boolean
  potionsConfig: PotionsConfig
  skillsCanRun: boolean
  skillsConfig: SkillsConfig
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

  const toggleRunning = useCallback(() => {
    if (potionsRunningRef.current || skillsRunningRef.current) {
      invoke("stop_all")
      setPotionsRunning(false)
      setSkillsRunning(false)
      onStopRef.current?.()
      return
    }

    const pCan = potionsCanRunRef.current
    const sCan = skillsCanRunRef.current

    if (!pCan && !sCan) {
      toast.warning("Enable at least one channel first")
      return
    }

    if (pCan) {
      const c = potionsConfigRef.current
      invoke("start_potions", {
        config: {
          keys: c.keys,
          delayMs: c.delayMs,
          repeatMode: c.repeatMode,
          repeatCount: c.repeatCount,
        },
      })
      setPotionsRunning(true)
    }

    if (sCan) {
      const c = skillsConfigRef.current
      invoke("start_skills", {
        config: {
          holdRightClick: c.holdRightClick,
          steps: c.steps,
          repeatMode: c.repeatMode,
          repeatCount: c.repeatCount,
        },
      })
      setSkillsRunning(true)
    }

    onStartRef.current?.()
  }, [])

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
  }
}
