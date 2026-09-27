import { useTheme } from "next-themes"
import { Check, ChevronDown, FilePlus, FolderOpen, History, Moon, Play, RotateCcw, Save, SaveAll, Square, Sun } from "lucide-react"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/shared/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/components/ui/dropdown-menu"
import { formatElapsed } from "@/shared/format"
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
  running, elapsed, fileName, isDirty, isProcessing, canRun, compactMode,
  lastStopReason = null, onToggleRunning, onReset, onOpen, onNew, onSave,
  onSaveAs, recentFiles, onOpenRecent, onClearRecent, comboFiles,
  onRequestComboFiles, onSelectComboFile,
}: AppHeaderProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const stopReasonLabel: Record<RunStopReason, string> = {
    manual: "Manual",
    emergency: "Emergency",
    "repeat-complete": "Repeat complete",
    "focus-lost": "Focus lost",
    "profile-switch": "Profile switched",
    "startup-failure": "Start failed",
    "injection-failure": "Input failed",
  }

  return (
    <header className="flex shrink-0 items-center justify-between gap-2 border-y px-2.5 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <DropdownMenu onOpenChange={(open) => open && onRequestComboFiles()}>
          <DropdownMenuTrigger render={<Button size="xs" variant="ghost" className="h-7 min-w-0 gap-1 px-2 text-xs" aria-label="Switch combo file"><span className="max-w-[170px] truncate">{fileName ? fileName.split(/[\\/]/).pop() : "Untitled"}</span><ChevronDown className="size-3 shrink-0" /></Button>} />
          <DropdownMenuContent align="start">
            <DropdownMenuGroup><DropdownMenuLabel>Combo files</DropdownMenuLabel></DropdownMenuGroup>
            {comboFiles.length === 0 ? <DropdownMenuItem disabled>No combo files found</DropdownMenuItem> : comboFiles.map((file) => (
              <DropdownMenuItem key={file.path} onClick={() => onSelectComboFile(file.path)} title={file.path}>
                <span className="max-w-[220px] truncate">{file.name}</span>
                {fileName === file.path && <Check className="ml-auto size-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {isDirty && <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">Unsaved</Badge>}
        <Badge variant={running ? "default" : "secondary"} className="min-w-[84px] justify-center gap-1.5" title={!running && lastStopReason ? `Last result: ${stopReasonLabel[lastStopReason]}` : undefined}>
          <span className={`size-2 rounded-full ${running ? "bg-green-500" : "bg-muted-foreground"}`} />
          {running ? `Running · ${formatElapsed(elapsed)}` : "Stopped"}
        </Badge>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {running && !compactMode ? (
          <Button size="sm" variant="destructive" onClick={onToggleRunning}><Square className="size-4" /> Stop</Button>
        ) : (
          <Button size="sm" className="bg-green-600 text-white hover:bg-green-700" onClick={onToggleRunning} disabled={!running && (!canRun || isProcessing)}><Play className="size-4" /> Run</Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="sm" variant="ghost" disabled={isProcessing}>File <ChevronDown className="size-3" /></Button>} />
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuItem onClick={onNew}><FilePlus /> New <span className="ml-auto text-xs text-muted-foreground">Ctrl+N</span></DropdownMenuItem>
            <DropdownMenuItem onClick={onOpen}><FolderOpen /> Open <span className="ml-auto text-xs text-muted-foreground">Ctrl+O</span></DropdownMenuItem>
            <DropdownMenuItem disabled={!isDirty} onClick={onSave}><Save /> Save <span className="ml-auto text-xs text-muted-foreground">Ctrl+S</span></DropdownMenuItem>
            <DropdownMenuItem onClick={onSaveAs}><SaveAll /> Save as…</DropdownMenuItem>
            {recentFiles.length > 0 && <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup><DropdownMenuLabel className="flex items-center gap-2"><History className="size-3.5" /> Recent</DropdownMenuLabel></DropdownMenuGroup>
              {recentFiles.map((path) => <DropdownMenuItem key={path} onClick={() => onOpenRecent(path)} title={path}><span className="max-w-[220px] truncate">{path.split(/[\\/]/).pop()}</span></DropdownMenuItem>)}
              <DropdownMenuItem variant="destructive" onClick={onClearRecent}>Clear recent files</DropdownMenuItem>
            </>}
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialog>
          <Tooltip>
            <TooltipTrigger render={<AlertDialogTrigger render={<Button size="icon" variant="ghost" aria-label="Reset settings"><RotateCcw /></Button>} />} />
            <TooltipContent>Reset all settings…</TooltipContent>
          </Tooltip>
          <AlertDialogContent size="sm">
            <AlertDialogHeader><AlertDialogTitle>Reset to defaults?</AlertDialogTitle><AlertDialogDescription>This overwrites your current keys, delay, hotkey, and repeat settings, and stops any running macro. This can't be undone.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={onReset}>Reset</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Tooltip>
          <TooltipTrigger render={<Button size="icon" variant="ghost" aria-label="Toggle theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}><Sun className="hidden dark:block" /><Moon className="block dark:hidden" /></Button>} />
          <TooltipContent>{resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}</TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}
