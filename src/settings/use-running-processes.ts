import { useCallback, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

export type RunningProcess = {
  pid: number
  name: string
  title: string | null
  /** Friendly name from the exe's version resource (e.g. "Google Chrome"). */
  friendly: string | null
}

/**
 * Loads the running-process snapshot on demand for the Settings → Auto-stop
 * picker. `refresh` re-queries so a game launched since the last open shows up.
 */
export function useRunningProcesses() {
  const [processes, setProcesses] = useState<RunningProcess[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setProcesses(await invoke<RunningProcess[]>("list_processes"))
    } catch (e) {
      toast.error(`Failed to list processes: ${e}`)
    } finally {
      setLoading(false)
    }
  }, [])

  return { processes, loading, refresh }
}
