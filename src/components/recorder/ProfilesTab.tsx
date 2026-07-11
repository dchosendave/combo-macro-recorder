import { useState } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { Plus, Trash2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Profile } from "@/lib/settings"

type ProfilesTabProps = {
  profiles: Profile[]
  activeProfileId: string
  setActiveProfileId: (id: string) => void
  onAddProfile: () => void
  onDeleteProfile: (id: string) => void
  onRenameProfile: (id: string, name: string) => void
  onUpdateHotkey: (id: string, hotkey: string) => void
}

export function ProfilesTab({
  profiles,
  activeProfileId,
  setActiveProfileId,
  onAddProfile,
  onDeleteProfile,
  onRenameProfile,
  onUpdateHotkey,
}: ProfilesTabProps) {
  const [capturingId, setCapturingId] = useState<string | null>(null)
  const [alwaysOnTop, setAlwaysOnTop] = useState(false)

  const toggleAlwaysOnTop = async (v: boolean) => {
    setAlwaysOnTop(v)
    await getCurrentWindow().setAlwaysOnTop(v)
  }

  const handleKeyCapture = (e: React.KeyboardEvent) => {
    if (!capturingId) return
    e.preventDefault()
    if (e.key === "Escape") {
      setCapturingId(null)
      return
    }
    if (e.key.length === 1 || e.key.startsWith("F")) {
      onUpdateHotkey(capturingId, e.key)
    }
    setCapturingId(null)
  }

  return (
    <Card size="sm" className="h-full" onKeyDown={handleKeyCapture} tabIndex={0}>
      <CardContent className="flex flex-col gap-3 overflow-y-auto">
        <div className="flex flex-col gap-2">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              onClick={() => setActiveProfileId(profile.id)}
              className={`flex flex-col gap-2 rounded-xl border px-3 py-2 transition-colors cursor-pointer ${
                profile.id === activeProfileId
                  ? "border-primary bg-primary/10 ring-1 ring-primary"
                  : "hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <Input
                  value={profile.name}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onRenameProfile(profile.id, e.target.value)}
                  className="h-7 flex-1 text-sm font-medium"
                />
                {profiles.length > 1 && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6 shrink-0"
                          aria-label="Delete profile"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteProfile(profile.id)
                          }}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      }
                    />
                    <TooltipContent>Delete profile</TooltipContent>
                  </Tooltip>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Hotkey:</span>
                {capturingId === profile.id ? (
                  <span className="text-xs font-medium text-primary">Press a key...</span>
                ) : (
                  <Kbd>{profile.hotkey}</Kbd>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                    setCapturingId(capturingId === profile.id ? null : profile.id)
                  }}
                >
                  {capturingId === profile.id ? "Cancel" : "Change"}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onAddProfile}
          className="gap-1.5"
        >
          <Plus className="size-3.5" />
          Add Profile
        </Button>

        <Separator />

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="always-on-top-profiles" className="font-normal">
            Always on top
          </Label>
          <Switch
            id="always-on-top-profiles"
            checked={alwaysOnTop}
            onCheckedChange={toggleAlwaysOnTop}
          />
        </div>
      </CardContent>
    </Card>
  )
}
