import { useTheme } from "next-themes"
import { Check, ChevronDown, FilePlus, FolderOpen, History, Moon, Play, RotateCcw, Save, SaveAll, Square, Sun } from "lucide-react"
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu"
import { formatElapsed } from "@/shared/format"
import { SidebarTrigger } from "@/shared/components/ui/sidebar"
import type { ComboFileEntry } from "@/combo-file/use-combo-files"
import type { RunStopReason } from "@/runner/use-macro-runner"

type AppHeaderProps = {
  running: boolean
  elapsed: number
  fileName: string | null
  isDirty: boolean
  isProcessing: boolean
  lastSavedAt?: number | null
  canRun: boolean
  compactMode: boolean
  lastStopReason?: RunStopReason | null
  onToggleRunning: () => void
  onReset: () => void
  onOpen: () => void
  onNew: () => void
  onSave: () => void
  onSaveAs: () => void
  recentFiles: string[]
  onOpenRecent: (path: string) => void
  onClearRecent: () => void
  comboFiles: ComboFileEntry[]
  onRequestComboFiles: () => void
  onSelectComboFile: (path: string) => void
}

export function AppHeader({
  running,
  elapsed,
  fileName,
  isDirty,
  isProcessing,
  lastSavedAt = null,
  canRun,
  compactMode,
  lastStopReason = null,
  onToggleRunning,
  onReset,
  onOpen,
  onNew,
  onSave,
  onSaveAs,
  recentFiles,
  onOpenRecent,
  onClearRecent,
  comboFiles,
  onRequestComboFiles,
  onSelectComboFile,
}: AppHeaderProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const stopReasonLabel: Record<RunStopReason, string> = {
    manual: "Manual",
    emergency: "Emergency",
    "repeat-complete": "Repeat complete",
    "focus-lost": "Focus lost",
    "profile-switch": "Profile switched",
    "startup-failure": "Start failed",
  }

  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <SidebarTrigger size="icon" className="text-muted-foreground" />
        <DropdownMenu
          onOpenChange={(open) => {
            if (open) onRequestComboFiles()
          }}
        >
          <DropdownMenuTrigger
            render={
              <Button
                size="xs"
                variant="ghost"
                className="h-6 gap-1 px-2 text-xs text-muted-foreground"
                aria-label="Switch combo file"
              >
                <span className="max-w-[180px] truncate">
                  {fileName ? fileName.split(/[\\/]/).pop() : "Untitled"}
                </span>
                <ChevronDown className="size-3 shrink-0" />
              </Button>
            }
          />
          <DropdownMenuContent align="start">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Combo files</DropdownMenuLabel>
            </DropdownMenuGroup>
            {comboFiles.length === 0 ? (
              <DropdownMenuItem disabled>No combo files found</DropdownMenuItem>
            ) : (
              comboFiles.map((file) => (
                <DropdownMenuItem
                  key={file.path}
                  onClick={() => onSelectComboFile(file.path)}
                  title={file.path}
                >
                  <span className="max-w-[220px] truncate">{file.name}</span>
                  {fileName === file.path && <Check className="ml-auto size-4" />}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {isDirty ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">Unsaved</Badge>
              }
            />
            <TooltipContent>Unsaved changes</TooltipContent>
          </Tooltip>
        ) : lastSavedAt ? (
          <span className="hidden text-[11px] text-muted-foreground xl:inline" title={new Date(lastSavedAt).toLocaleString()}>
            Saved {new Date(lastSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </span>
        ) : null}
        <Badge
          variant={running ? "default" : "secondary"}
          className="gap-1.5 min-w-[130px]"
          title={!running && lastStopReason ? `Last result: ${stopReasonLabel[lastStopReason]}` : undefined}
        >
          <span
            className={`size-2 rounded-full transition-colors duration-300 ${running ? "bg-green-500" : "bg-muted-foreground"}`}
          />
          {running
            ? `Running · ${formatElapsed(elapsed)}`
            : lastStopReason
              ? `Stopped · ${stopReasonLabel[lastStopReason]}`
              : "Stopped"}
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
            className="bg-green-600 text-white hover:bg-green-700"
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
                variant={isDirty ? "secondary" : "ghost"}
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
              <DropdownMenuGroup>
                <DropdownMenuLabel>Recent combos</DropdownMenuLabel>
              </DropdownMenuGroup>
              {recentFiles.map((path) => (
                <DropdownMenuItem key={path} onClick={() => onOpenRecent(path)} title={path}>
                  <span className="max-w-[220px] truncate">{path.split(/[\\/]/).pop()}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onClearRecent}>
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
