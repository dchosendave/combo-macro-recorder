import { useCallback, useEffect, useState } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    const win = getCurrentWindow()
    win.isMaximized().then(setIsMaximized)

    const unlisten = win.onResized(async () => {
      setIsMaximized(await win.isMaximized())
    })
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [])

  const handleMinimize = useCallback(() => {
    getCurrentWindow().minimize()
  }, [])

  const handleToggleMaximize = useCallback(() => {
    getCurrentWindow().toggleMaximize()
  }, [])

  const handleClose = useCallback(() => {
    getCurrentWindow().close()
  }, [])

  return (
    <div
      data-tauri-drag-region
      className="flex h-8 shrink-0 items-center select-none"
    >
      <span
        data-tauri-drag-region
        className="pl-3 text-xs font-medium text-muted-foreground"
      >
        Combo Macro Recorder
      </span>

      <div className="ml-auto flex h-full">
        <button
          onClick={handleMinimize}
          className="flex h-full w-[46px] items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Minimize"
        >
          <svg width="10" height="1" viewBox="0 0 10 1">
            <rect width="10" height="1" fill="currentColor" />
          </svg>
        </button>

        <button
          onClick={handleToggleMaximize}
          className="flex h-full w-[46px] items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="2" y="0" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1" />
              <rect x="0" y="2" width="8" height="8" rx="1" fill="var(--background, #fff)" stroke="currentColor" strokeWidth="1" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect width="10" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
          )}
        </button>

        <button
          onClick={handleClose}
          className="flex h-full w-[46px] items-center justify-center text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
          aria-label="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>
    </div>
  )
}
