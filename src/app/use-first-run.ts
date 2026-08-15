import { useCallback, useState } from "react"
import { loadTutorialSeen, saveTutorialSeen } from "@/shared/persistence"

/** Whether the user has never dismissed the first-run tutorial. `markTutorialSeen` persists the flag so the tutorial shows exactly once. */
export function useFirstRun() {
  const [isFirstRun, setIsFirstRun] = useState(() => !loadTutorialSeen())

  const markTutorialSeen = useCallback(() => {
    saveTutorialSeen()
    setIsFirstRun(false)
  }, [])

  return { isFirstRun, markTutorialSeen }
}
