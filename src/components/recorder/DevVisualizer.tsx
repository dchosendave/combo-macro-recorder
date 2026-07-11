import { useEffect, useState } from "react"
import { listen } from "@tauri-apps/api/event"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

export function DevVisualizer() {
  const [log, setLog] = useState("")

  useEffect(() => {
    const unlisten = listen<{ cycle: number; keys: string[] }>(
      "macro-activation",
      (event) => {
        const line = `#${event.payload.cycle}: ${event.payload.keys
          .join(" ")
          .toUpperCase()}`
        setLog((prev) => (prev ? `${prev}\n${line}` : line))
      }
    )
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [])

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Dev: loop visualizer (keys only inject into other apps on Windows)
        </span>
        <Button size="xs" variant="ghost" onClick={() => setLog("")}>
          Clear
        </Button>
      </div>
      <Textarea
        readOnly
        value={log}
        placeholder="Pressed keys will appear here while running…"
        className="h-24 font-mono text-xs"
      />
    </div>
  )
}
