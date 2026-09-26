import { Switch } from "@/shared/components/ui/switch"
import { Label } from "@/shared/components/ui/label"
import { Input } from "@/shared/components/ui/input"
import { Kbd } from "@/shared/components/ui/kbd"
import { Separator } from "@/shared/components/ui/separator"
import { RepeatModeControl } from "@/shared/components/repeat-mode-control"
import { MIN_DELAY } from "@/shared/defaults"
import { type PotionKey, type RepeatMode } from "@/shared/types"

const POTION_KEYS: PotionKey[] = ["q", "w", "e", "r"]

type KeysTabProps = {
  autoPotions: boolean
  setAutoPotions: (value: boolean) => void
  keys: Record<PotionKey, boolean>
  togglePotionKey: (key: PotionKey) => void
  customDelay: boolean
  setCustomDelayEnabled: (enabled: boolean) => void
  delayMs: string
  setDelayMs: (value: string) => void
  delayError: boolean
  repeatMode: RepeatMode
  setRepeatMode: (mode: RepeatMode) => void
  repeatCount: string
  setRepeatCount: (value: string) => void
  repeatError: boolean
}

export function KeysTab({
  autoPotions,
  setAutoPotions,
  keys,
  togglePotionKey,
  customDelay,
  setCustomDelayEnabled,
  delayMs,
  setDelayMs,
  delayError,
  repeatMode,
  setRepeatMode,
  repeatCount,
  setRepeatCount,
  repeatError,
}: KeysTabProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto p-2 text-[13px] [&_button]:text-[13px] [&_input]:text-[13px] [&_label]:text-[13px]">
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

        {autoPotions ? (
          <div className="grid grid-cols-4 gap-1.5 animate-in fade-in-0 slide-in-from-top-2 duration-200">
            {POTION_KEYS.map((key) => (
              <div
                key={key}
                role="button"
                tabIndex={0}
                onClick={() => togglePotionKey(key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    togglePotionKey(key)
                  }
                }}
                className="flex items-center justify-between gap-2 rounded-lg border px-2 py-1 transition-colors cursor-pointer hover:bg-muted/50"
              >
                <span className="flex items-center gap-2 text-sm">
                  <Kbd>{key.toUpperCase()}</Kbd>
                </span>
                <Switch
                  checked={keys[key]}
                  onClick={(e) => e.stopPropagation()}
                  onCheckedChange={() => togglePotionKey(key)}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Turn on to configure Q/W/E/R.
          </p>
        )}

        <Separator />

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="enable-custom-delay" className="font-normal">
              Enable custom hold duration for the auto potions
            </Label>
            <Switch
              id="enable-custom-delay"
              checked={customDelay}
              onCheckedChange={setCustomDelayEnabled}
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
              className="h-8 w-24"
            />
            <span className="text-sm text-muted-foreground">ms</span>
          </div>

          <p
            className={`text-xs ${delayError ? "text-destructive" : "text-muted-foreground"
              }`}
          >
            {delayError
              ? `Enter whole milliseconds from ${MIN_DELAY} to 86400000.`
              : `Digits only. Lowest is ${MIN_DELAY}ms.`}
          </p>
        </div>

        <Separator />

        <RepeatModeControl
          repeatMode={repeatMode}
          setRepeatMode={setRepeatMode}
          repeatCount={repeatCount}
          setRepeatCount={setRepeatCount}
          repeatError={repeatError}
        />
    </div>
  )
}
