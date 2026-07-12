import { useCallback, useEffect, useRef, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { open, save } from "@tauri-apps/plugin-dialog"
import { toast } from "sonner"
import { exportComboToString, importComboFromString } from "@/features/combo-file/lib/combo-io"
import { defaultPotionConfig, defaultSkillConfig } from "@/shared/lib/defaults"
import type { CurrentCombo } from "@/shared/lib/types"

const EMPTY_BASELINE = exportComboToString({ potions: defaultPotionConfig(), skills: defaultSkillConfig() })

type UseComboFileArgs = {
  getCombo: () => CurrentCombo
  applyCombo: (combo: CurrentCombo) => void
}

type PendingAction = "open" | "new"

export function useComboFile({ getCombo, applyCombo }: UseComboFileArgs) {
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null)
  const [baseline, setBaseline] = useState(EMPTY_BASELINE)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const currentFilePathRef = useRef(currentFilePath)
  currentFilePathRef.current = currentFilePath

  const getComboRef = useRef(getCombo)
  getComboRef.current = getCombo

  const isDirty = exportComboToString(getCombo()) !== baseline

  const doNew = useCallback(() => {
    const combo: CurrentCombo = { potions: defaultPotionConfig(), skills: defaultSkillConfig() }
    applyCombo(combo)
    setCurrentFilePath(null)
    setBaseline(exportComboToString(combo))
    setIsProcessing(false)
  }, [applyCombo])

  const openFile = useCallback(async () => {
    if (isProcessing) return false
    setIsProcessing(true)
    try {
      const path = await open({
        filters: [{ name: "JSON", extensions: ["json"] }],
        multiple: false,
      })
      if (!path) {
        setIsProcessing(false)
        return false
      }
      const content = await invoke<string>("read_file", { path: path as string })
      const combo = importComboFromString(content)
      applyCombo(combo)
      setCurrentFilePath(path as string)
      setBaseline(exportComboToString(combo))
      const openedName = (path as string).split(/[\\/]/).pop() ?? path
      toast.success(`Opened ${openedName}`)
      setIsProcessing(false)
      return true
    } catch (e) {
      toast.error(`Open failed: ${e}`)
      setIsProcessing(false)
      return false
    }
  }, [applyCombo, isProcessing])

  const saveToPath = useCallback(
    async (path: string) => {
      const json = exportComboToString(getComboRef.current())
      await invoke("save_file", { path, content: json })
      setCurrentFilePath(path)
      setBaseline(json)
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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        saveFile()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [saveFile])

  const requestOpen = useCallback(() => {
    if (isDirty) {
      setPendingAction("open")
      return
    }
    openFile()
  }, [isDirty, openFile])

  const requestNew = useCallback(() => {
    if (isDirty) {
      setPendingAction("new")
      return
    }
    doNew()
  }, [isDirty, doNew])

  const confirmDiscard = useCallback(() => {
    const action = pendingAction
    setPendingAction(null)
    if (action === "open") {
      openFile()
    } else if (action === "new") {
      doNew()
    }
  }, [pendingAction, openFile, doNew])

  const cancelDiscard = useCallback(() => {
    setPendingAction(null)
  }, [])

  return {
    currentFilePath, setCurrentFilePath,
    openFile, saveFile, saveFileAs,
    newCombo: doNew,
    isDirty,
    pendingAction,
    requestOpen, requestNew,
    confirmDiscard, cancelDiscard,
  }
}
