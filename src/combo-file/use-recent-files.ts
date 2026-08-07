import { useCallback, useState } from "react"
import { addRecentPath, clearRecentFiles, loadRecentFiles, saveRecentFiles } from "@/shared/persistence"

export function useRecentFiles() {
  const [recentFiles, setRecentFiles] = useState<string[]>(loadRecentFiles)
  const addRecent = useCallback((path: string) => {
    setRecentFiles((prev) => {
      const next = addRecentPath(prev, path)
      saveRecentFiles(next)
      return next
    })
  }, [])
  const removeRecent = useCallback((path: string) => {
    setRecentFiles((prev) => {
      const next = prev.filter((p) => p !== path)
      saveRecentFiles(next)
      return next
    })
  }, [])
  const clearRecent = useCallback(() => {
    clearRecentFiles()
    setRecentFiles([])
  }, [])
  return { recentFiles, addRecent, removeRecent, clearRecent }
}
