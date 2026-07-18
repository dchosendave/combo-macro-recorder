import { Switch } from "@/shared/components/ui/switch"
import { Label } from "@/shared/components/ui/label"
import { Input } from "@/shared/components/ui/input"
import { Kbd } from "@/shared/components/ui/kbd"
import { Card, CardContent } from "@/shared/components/ui/card"
import { Separator } from "@/shared/components/ui/separator"
import { RepeatModeControl } from "@/shared/components/RepeatModeControl"
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
    <Card size="sm" className="h-full">
      <CardContent className="flex flex-1 flex-col gap-4 min-h-0 overflow-y-auto">
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
          <div className="grid grid-cols-2 gap-2 animate-in fade-in-0 slide-in-from-top-2 duration-200">
            {POTION_KEYS.map((key) => (
              <div
                key={key}
                className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2 text-sm">
                  <Kbd>{key.toUpperCase()}</Kbd>
                </span>
                <Switch
                  checked={keys[key]}
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

        <div className="flex flex-col gap-2">
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

        <Separator />

        <RepeatModeControl
          repeatMode={repeatMode}
          setRepeatMode={setRepeatMode}
          repeatCount={repeatCount}
          setRepeatCount={setRepeatCount}
          repeatError={repeatError}
        />
      </CardContent>
    </Card>
  )
}
