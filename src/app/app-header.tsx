import { useTheme } from "next-themes"
import { FilePlus, FolderOpen, History, Moon, Play, RotateCcw, Save, SaveAll, Square, Sun } from "lucide-react"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip"
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
} from "@/shared/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu"
import { formatElapsed } from "@/shared/format"

type AppHeaderProps = {
  running: boolean
  elapsed: number
  fileName: string | null
  isDirty: boolean
  isProcessing: boolean
  canRun: boolean
  compactMode: boolean
  onToggleRunning: () => void
  onReset: () => void
  onOpen: () => void
  onNew: () => void
  onSave: () => void
  onSaveAs: () => void
  recentFiles: string[]
  onOpenRecent: (path: string) => void
  onClearRecent: () => void
}

export function AppHeader({
  running,
  elapsed,
  fileName,
  isDirty,
  isProcessing,
  canRun,
  compactMode,
  onToggleRunning,
  onReset,
  onOpen,
  onNew,
  onSave,
  onSaveAs,
  recentFiles,
  onOpenRecent,
  onClearRecent,
}: AppHeaderProps) {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className="font-heading text-base font-semibold">
          Combo
        </span>
        <span className="max-w-[180px] truncate text-xs text-muted-foreground">
          {fileName ? fileName.split(/[\\/]/).pop() : "Untitled"}
        </span>
        {isDirty && (
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="size-1.5 rounded-full bg-amber-400" />
              }
            />
            <TooltipContent>Unsaved changes</TooltipContent>
          </Tooltip>
        )}
        <Badge variant={running ? "default" : "secondary"} className="gap-1.5 min-w-[130px]">
          <span
            className={`size-2 rounded-full transition-colors duration-300 ${running ? "bg-green-500" : "bg-muted-foreground"}`}
          />
          {running ? `Running · ${formatElapsed(elapsed)}` : "Stopped"}
        </Badge>
      </div>
      <div className="flex items-center gap-1">
        {running && !compactMode ? (
          <Button size="sm" variant="destructive" onClick={onToggleRunning}>
            <Square className="size-4" />
            Stop
          </Button>
        ) : (
          <Button
            size="sm"
            variant="default"
            onClick={onToggleRunning}
            disabled={!canRun || isProcessing}
          >
            <Play className="size-4" />
            Run
          </Button>
        )}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon"
                variant="ghost"
                disabled={isProcessing}
                aria-label="New file"
                onClick={onNew}
              >
                <FilePlus className="size-4" />
              </Button>
            }
          />
          <TooltipContent>New (Ctrl+N)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon"
                variant="ghost"
                disabled={isProcessing}
                aria-label="Open file"
                onClick={onOpen}
              >
                <FolderOpen className="size-4" />
              </Button>
            }
          />
          <TooltipContent>Open (Ctrl+O)</TooltipContent>
        </Tooltip>
        {recentFiles.length > 0 && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger
                render={
                  <DropdownMenuTrigger
                    render={
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={isProcessing}
                        aria-label="Recent combos"
                      >
                        <History className="size-4" />
                      </Button>
                    }
                  />
                }
              />
              <TooltipContent>Recent combos</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Recent combos</DropdownMenuLabel>
              {recentFiles.map((path) => (
                <DropdownMenuItem key={path} onSelect={() => onOpenRecent(path)} title={path}>
                  <span className="max-w-[220px] truncate">{path.split(/[\\/]/).pop()}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onClearRecent}>
                Clear recent files
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon"
                variant="ghost"
                disabled={isProcessing || !isDirty}
                aria-label="Save"
                onClick={onSave}
              >
                <Save className="size-4" />
              </Button>
            }
          />
          <TooltipContent>Save (Ctrl+S)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon"
                variant="ghost"
                disabled={isProcessing}
                aria-label="Save as"
                onClick={onSaveAs}
              >
                <SaveAll className="size-4" />
              </Button>
            }
          />
          <TooltipContent>Save As…</TooltipContent>
        </Tooltip>
        <AlertDialog>
          <Tooltip>
            <TooltipTrigger
              render={
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
              }
            />
            <TooltipContent>Reset all settings…</TooltipContent>
          </Tooltip>
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
          <TooltipContent>
            {resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}
