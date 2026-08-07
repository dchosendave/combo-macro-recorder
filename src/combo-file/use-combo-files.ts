import { useCallback, useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"

export type ComboFileEntry = { name: string; path: string }

const COMBO_DIR_KEY = "combo-macro-combo-dir"

/** Lists `.json` combo files from the user's combo directory (`combo-macro-combo-dir`, set in the Hotkeys tab). Loads on mount and via `refreshComboFiles`; an unset or missing directory yields an empty list. */
export function useComboFiles() {
  const [comboFiles, setComboFiles] = useState<ComboFileEntry[]>([])
  const refreshComboFiles = useCallback(async () => {
    const dir = localStorage.getItem(COMBO_DIR_KEY)
    if (!dir) {
      setComboFiles([])
      return
    }
    try {
      const files = await invoke<ComboFileEntry[]>("list_combo_files", { path: dir })
      setComboFiles(files)
    } catch {
      setComboFiles([])
    }
  }, [])
  useEffect(() => {
    refreshComboFiles()
  }, [refreshComboFiles])
  return { comboFiles, refreshComboFiles }
}
