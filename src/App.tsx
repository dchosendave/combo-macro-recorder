import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Kbd } from "@/components/ui/kbd"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import "./App.css"

const MIN_DELAY = 2

function App() {
  const { resolvedTheme, setTheme } = useTheme()
  const [autoPotions, setAutoPotions] = useState(false)
  const [customDelay, setCustomDelay] = useState(false)
  const [delayMs, setDelayMs] = useState("")
  const [running, setRunning] = useState(false)

  const delayError =
    customDelay && delayMs !== "" && Number(delayMs) < MIN_DELAY

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F5") {
        e.preventDefault()
        setRunning(true)
      } else if (e.key === "F4") {
        e.preventDefault()
        setRunning(false)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <main className="flex min-h-screen flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="font-heading text-base font-semibold">
            Configuration
          </span>
          <Badge variant={running ? "default" : "secondary"} className="gap-1.5">
            <span
              className={`size-2 rounded-full ${running ? "bg-green-500" : "bg-muted-foreground"
                }`}
            />
            {running ? "Running" : "Stopped"}
          </Badge>
        </div>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Toggle theme"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          <Sun className="hidden dark:block" />
          <Moon className="block dark:hidden" />
        </Button>
      </header>

      <Card size="sm" className="flex-1">
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="enable-qwer" className="font-normal">
              Enable QWER keys for auto potions
            </Label>
            <Switch
              id="enable-qwer"
              checked={autoPotions}
              onCheckedChange={setAutoPotions}
            />
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="enable-custom-delay" className="font-normal">
                Enable custom delays for the auto potions
              </Label>
              <Switch
                id="enable-custom-delay"
                checked={customDelay}
                onCheckedChange={setCustomDelay}
              />
            </div>

            <div className="flex items-center gap-2">
              <Input
                id="custom-delay"
                inputMode="numeric"
                disabled={!customDelay}
                aria-invalid={delayError}
                value={delayMs}
                onChange={(e) =>
                  setDelayMs(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="e.g. 250"
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">ms</span>
            </div>

            <p
              className={`text-xs ${delayError ? "text-destructive" : "text-muted-foreground"
                }`}
            >
              {delayError
                ? `Minimum is ${MIN_DELAY}ms.`
                : `Digits only. Lowest is ${MIN_DELAY}ms.`}
            </p>
          </div>
        </CardContent>
      </Card>

      <footer className="flex items-center gap-3">
        <Button
          variant="destructive"
          onClick={() => setRunning(false)}
          disabled={!running}
          className="flex-1 gap-2"
        >
          STOP <Kbd>F4</Kbd>
        </Button>
        <Button
          onClick={() => setRunning(true)}
          disabled={running}
          className="flex-1 gap-2"
        >
          START <Kbd>F5</Kbd>
        </Button>
      </footer>
    </main>
  )
}

export default App
