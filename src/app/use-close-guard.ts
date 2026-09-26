import { useCallback, useEffect, useRef, useState } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { toast } from "sonner"

export function useCloseGuard(isDirty: boolean, isProcessing: boolean) {
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const stateRef = useRef({ isDirty, isProcessing })
  stateRef.current = { isDirty, isProcessing }
  const confirmedRef = useRef(false)
  const requestClose = useCallback(() => {
    void getCurrentWindow().close().catch((error) => {
      confirmedRef.current = false
      toast.error(`Close failed: ${error}`)
    })
  }, [])
  const confirmClose = useCallback(() => {
    if (stateRef.current.isProcessing) return
    confirmedRef.current = true
    requestClose()
  }, [requestClose])

  useEffect(() => {
    const subscription = getCurrentWindow().onCloseRequested((event) => {
      if (stateRef.current.isProcessing) {
        event.preventDefault()
        toast.info("Wait for the file operation to finish before closing")
      } else if (!confirmedRef.current && stateRef.current.isDirty) {
        event.preventDefault()
        setShowCloseConfirm(true)
      }
      confirmedRef.current = false
    })
    return () => { void subscription.then((unlisten) => unlisten()) }
  }, [])

  return { showCloseConfirm, requestClose, confirmClose, cancelClose: () => setShowCloseConfirm(false) }
}
