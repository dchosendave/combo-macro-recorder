import { useTheme } from "next-themes"
import { Download, Moon, RotateCcw, Sun, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { formatElapsed } from "@/lib/settings"

type AppHeaderProps = {
  running: boolean
  elapsed: number
  activations: number
  onReset: () => void
  onExport: () => void
  onImport: () => void
}

export function AppHeader({
  running,
  elapsed,
  activations,
  onReset,
  onExport,
  onImport,
}: AppHeaderProps) {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className="font-heading text-base font-semibold">
          Configuration
        </span>
        <Badge variant={running ? "default" : "secondary"} className="gap-1.5">
          <span
            className={`size-2 rounded-full ${running ? "bg-green-500" : "bg-muted-foreground"}`}
          />
          {running ? `Running · ${formatElapsed(elapsed)}` : "Stopped"}
        </Badge>
        {running && (
          <span className="text-xs text-muted-foreground">
            {activations} activations
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon"
                variant="ghost"
                aria-label="Import profile"
                onClick={onImport}
              >
                <Upload className="size-4" />
              </Button>
            }
          />
          <TooltipContent>Import profile</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon"
                variant="ghost"
                aria-label="Export profile"
                onClick={onExport}
              >
                <Download className="size-4" />
              </Button>
            }
          />
          <TooltipContent>Export profile</TooltipContent>
        </Tooltip>
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                size="icon"
                variant="ghost"
                aria-label="Reset settings"
              >
                <RotateCcw />
              </Button>
            }
          />
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Reset to defaults?</AlertDialogTitle>
              <AlertDialogDescription>
                This overwrites your current keys, delay, hotkey, and repeat
                settings, and stops any running macro. This can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={onReset}>
                Reset
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon"
                variant="ghost"
                aria-label="Toggle theme"
                onClick={() =>
                  setTheme(resolvedTheme === "dark" ? "light" : "dark")
                }
              >
                <Sun className="hidden dark:block" />
                <Moon className="block dark:hidden" />
              </Button>
            }
          />
          <TooltipContent>Toggle theme</TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}
