import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { open, save } from "@tauri-apps/plugin-dialog"
import { toast } from "sonner"
import { exportComboToString, importComboFromString } from "@/combo-file/combo-io"
import { defaultPotionConfig, defaultSkillConfig } from "@/shared/defaults"
import type { CurrentCombo } from "@/shared/types"

const EMPTY_BASELINE = exportComboToString({ potions: defaultPotionConfig(), skills: defaultSkillConfig() })
const LAST_PATH_KEY = "combo-macro-last-path"

type UseComboFileArgs = {
  getCombo: () => CurrentCombo
  applyCombo: (combo: CurrentCombo) => void
  onSave?: (path: string) => void
  onOpened?: (path: string) => void
  onOpenFailed?: (path: string) => void
}

type PendingAction = { type: "open" | "new"; path?: string } | null
type PendingRecovery = { path: string; combo: CurrentCombo } | null

/** Combo file lifecycle: open/save/save-as/new with dirty tracking (string comparison against a baseline snapshot), unsaved-changes confirm dialogs, Ctrl+S, and auto-load of the last file on startup. */
export function useComboFile({ getCombo, applyCombo, onSave, onOpened, onOpenFailed }: UseComboFileArgs) {
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null)
  const [baseline, setBaseline] = useState(EMPTY_BASELINE)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [pendingRecovery, setPendingRecovery] = useState<PendingRecovery>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)

  const currentFilePathRef = useRef(currentFilePath)
  currentFilePathRef.current = currentFilePath

  const getComboRef = useRef(getCombo)
  getComboRef.current = getCombo

  const isDirty = useMemo(
    () => exportComboToString(getCombo()) !== baseline,
    [getCombo, baseline],
  )

  const doNew = useCallback(() => {
    const combo: CurrentCombo = { potions: defaultPotionConfig(), skills: defaultSkillConfig() }
    applyCombo(combo)
    setCurrentFilePath(null)
    setLastSavedAt(null)
    setBaseline(exportComboToString(combo))
    localStorage.removeItem(LAST_PATH_KEY)
    setIsProcessing(false)
  }, [applyCombo])

  const openPathCore = useCallback(async (path: string): Promise<boolean> => {
    try {
      const content = await invoke<string>("read_file", { path })
      const combo = importComboFromString(content)
      applyCombo(combo)
      setCurrentFilePath(path)
      setLastSavedAt(null)
      setBaseline(exportComboToString(combo))
      localStorage.setItem(LAST_PATH_KEY, path)
      toast.success(`Opened ${path.split(/[\\/]/).pop() ?? path}`)
      onOpened?.(path)
      return true
    } catch (e) {
      try {
        const backup = await invoke<string>("read_backup_file", { path })
        const combo = importComboFromString(backup)
        setPendingRecovery({ path, combo })
        toast.warning("This combo is damaged, but a recovery copy is available")
        return false
      } catch {
        // No valid recovery copy exists; report the original open failure.
      }
      toast.error(`Open failed: ${e}`)
      onOpenFailed?.(path)
      return false
    }
  }, [applyCombo, onOpened, onOpenFailed])

  const openPath = useCallback(async (path: string): Promise<boolean> => {
    if (isProcessing) return false
    setIsProcessing(true)
    try {
      return await openPathCore(path)
    } finally {
      setIsProcessing(false)
    }
  }, [isProcessing, openPathCore])

  const openFile = useCallback(async () => {
    if (isProcessing) return false
    setIsProcessing(true)
    try {
      const path = await open({
        filters: [{ name: "JSON", extensions: ["json"] }],
        multiple: false,
      })
      if (!path) return false
      return await openPathCore(path)
    } finally {
      setIsProcessing(false)
    }
  }, [isProcessing, openPathCore])

  const saveToPath = useCallback(
    async (path: string) => {
      const json = exportComboToString(getComboRef.current())
      await invoke("save_file", { path, content: json })
      setCurrentFilePath(path)
      setBaseline(json)
      setLastSavedAt(Date.now())
      localStorage.setItem(LAST_PATH_KEY, path)
      onSave?.(path)
    },
    [],
  )

  const saveFile = useCallback(async () => {
    try {
      const existing = currentFilePathRef.current
      if (existing) {
        await saveToPath(existing)
        toast.success("Saved")
        return
      }
      const path = await save({
        defaultPath: "combo.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      })
      if (!path) return
      await saveToPath(path)
      toast.success("Saved")
    } catch (e) {
      toast.error(`Save failed: ${e}`)
    }
  }, [saveToPath])

  const saveFileAs = useCallback(async () => {
    try {
      const path = await save({
        defaultPath: "combo.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      })
      if (!path) return
      await saveToPath(path)
      toast.success("Saved")
    } catch (e) {
      toast.error(`Save failed: ${e}`)
    }
  }, [saveToPath])

  const requestOpen = useCallback(() => {
    if (isDirty) {
      setPendingAction({ type: "open" })
      return
    }
    openFile()
  }, [isDirty, openFile])

  const requestNew = useCallback(() => {
    if (isDirty) {
      setPendingAction({ type: "new" })
      return
    }
    doNew()
  }, [isDirty, doNew])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        saveFile()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault()
        requestNew()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "o") {
        e.preventDefault()
        requestOpen()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [saveFile, requestNew, requestOpen])

  const confirmDiscard = useCallback(() => {
    const action = pendingAction
    setPendingAction(null)
    if (!action) return
    if (action.type === "open") {
      if (action.path) openPath(action.path)
      else openFile()
    } else {
      doNew()
    }
  }, [pendingAction, openPath, openFile, doNew])

  const cancelDiscard = useCallback(() => {
    setPendingAction(null)
  }, [])

  const confirmRecovery = useCallback(async () => {
    const recovery = pendingRecovery
    if (!recovery) return false
    try {
      await invoke("restore_backup_file", { path: recovery.path })
      applyCombo(recovery.combo)
      setCurrentFilePath(recovery.path)
      setLastSavedAt(Date.now())
      setBaseline(exportComboToString(recovery.combo))
      localStorage.setItem(LAST_PATH_KEY, recovery.path)
      setPendingRecovery(null)
      onOpened?.(recovery.path)
      toast.success("Recovered the previous saved version")
      return true
    } catch (e) {
      toast.error(`Recovery failed: ${e}`)
      return false
    }
  }, [pendingRecovery, applyCombo, onOpened])

  const cancelRecovery = useCallback(() => setPendingRecovery(null), [])

  const requestOpenPath = useCallback((path: string) => {
    if (isDirty) {
      setPendingAction({ type: "open", path })
      return
    }
    openPath(path)
  }, [isDirty, openPath])

  const tryAutoLoad = useCallback(async (): Promise<boolean> => {
    const autoLoad = localStorage.getItem("combo-macro-auto-load") !== "false"
    const lastPath = localStorage.getItem(LAST_PATH_KEY)
    if (!autoLoad || !lastPath) return false

    try {
      const content = await invoke<string>("read_file", { path: lastPath })
      const combo = importComboFromString(content)
      applyCombo(combo)
      setCurrentFilePath(lastPath)
      setLastSavedAt(null)
      setBaseline(exportComboToString(combo))
      return true
    } catch {
      try {
        const backup = await invoke<string>("read_backup_file", { path: lastPath })
        const combo = importComboFromString(backup)
        setPendingRecovery({ path: lastPath, combo })
        toast.warning("Your last combo is damaged, but a recovery copy is available")
      } catch {
        localStorage.removeItem(LAST_PATH_KEY)
      }
      return false
    }
  }, [applyCombo])

  return {
    currentFilePath, setCurrentFilePath,
    openFile, openPath, saveFile, saveFileAs,
    newCombo: doNew,
    isDirty, isProcessing, lastSavedAt,
    pendingAction,
    pendingRecovery,
    requestOpen, requestNew, requestOpenPath,
    confirmDiscard, cancelDiscard,
    confirmRecovery, cancelRecovery,
    tryAutoLoad,
  }
}
