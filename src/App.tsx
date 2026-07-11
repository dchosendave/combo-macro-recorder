import { useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { AppHeader } from "@/components/recorder/AppHeader"
import { KeysTab } from "@/components/recorder/KeysTab"
import { HotkeysTab } from "@/components/recorder/HotkeysTab"
import { RunControl } from "@/components/recorder/RunControl"
import { DevVisualizer } from "@/components/recorder/DevVisualizer"
import { useSettings } from "@/hooks/useSettings"
import { useMacroRunner } from "@/hooks/useMacroRunner"
import { useHotkey } from "@/hooks/useHotkey"
import { toAccelerator } from "@/lib/settings"
import "./App.css"

function App() {
  const settings = useSettings()
  const [capturing, setCapturing] = useState(false)

  const { running, setRunning, elapsed, activations, toggleRunning } =
    useMacroRunner({
      canRun: settings.canRun,
      keys: settings.keys,
      delayMs: settings.delayMs,
      delayError: settings.delayError,
      repeatMode: settings.repeatMode,
      repeatCount: settings.repeatCount,
    })

  useHotkey({
    setHotkey: settings.setHotkey,
    capturing,
    setCapturing,
  })

  const handleReset = () => {
    setRunning(false)
    settings.reset()
  }

  useEffect(() => {
    const unlisten = listen("macro-toggle", () => {
      toggleRunning()
    })
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [toggleRunning])

  useEffect(() => {
    invoke("set_hotkey", { shortcut: toAccelerator(settings.hotkey) }).catch(
      () => toast.warning(`"${settings.hotkey}" can't be used as a global hotkey`)
    )
  }, [settings.hotkey])

  return (
    <main className="flex min-h-screen flex-col gap-4 p-4">
      <AppHeader
        running={running}
        elapsed={elapsed}
        activations={activations}
        onReset={handleReset}
      />

      <Tabs defaultValue="keys" className="flex-1">
        <TabsList className="w-full">
          <TabsTrigger value="keys">Keys</TabsTrigger>
          <TabsTrigger value="hotkeys">Hotkeys</TabsTrigger>
        </TabsList>

        <TabsContent value="keys">
          <KeysTab
            autoPotions={settings.autoPotions}
            setAutoPotions={settings.setAutoPotions}
            keys={settings.keys}
            togglePotionKey={settings.togglePotionKey}
            customDelay={settings.customDelay}
            setCustomDelayEnabled={settings.setCustomDelayEnabled}
            delayMs={settings.delayMs}
            setDelayMs={settings.setDelayMs}
            delayError={settings.delayError}
            repeatMode={settings.repeatMode}
            setRepeatMode={settings.setRepeatMode}
            repeatCount={settings.repeatCount}
            setRepeatCount={settings.setRepeatCount}
            repeatError={settings.repeatError}
          />
        </TabsContent>

        <TabsContent value="hotkeys">
          <HotkeysTab
            hotkey={settings.hotkey}
            capturing={capturing}
            setCapturing={setCapturing}
          />
        </TabsContent>
      </Tabs>

      <RunControl
        running={running}
        canRun={settings.canRun}
        hotkey={settings.hotkey}
        onToggle={toggleRunning}
      />

      {/* <DevVisualizer /> */}
    </main>
  )
}

export default App
