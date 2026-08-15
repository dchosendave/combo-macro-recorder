import { useState } from "react"
import { Keyboard } from "lucide-react"
import { Button } from "@/shared/components/ui/button"
import { Kbd } from "@/shared/components/ui/kbd"
import {
  Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/shared/components/ui/command"
import { eventCodeToSkillKey, normalizeSkillKey, SKILL_KEY_GROUPS } from "@/shared/skill-keys"

type SkillKeyPickerProps = {
  value: string
  disabled?: boolean
  invalid?: boolean
  onChange: (value: string) => void
}

export function SkillKeyPicker({ value, disabled, invalid, onChange }: SkillKeyPickerProps) {
  const [open, setOpen] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const choose = (key: string) => {
    onChange(normalizeSkillKey(key) ?? key)
    setOpen(false)
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className="h-7 min-w-20 justify-start px-2 text-xs aria-invalid:border-destructive"
        onClick={(event) => { event.stopPropagation(); setOpen(true) }}
      >
        <Keyboard className="size-3" />
        {value ? <Kbd>{normalizeSkillKey(value) ?? value}</Kbd> : "Choose key"}
      </Button>
      <CommandDialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setCapturing(false) }} title="Choose a macro key" description="Search or press a supported key">
        <Command onKeyDown={(event) => {
          if (!capturing) return
          if (event.ctrlKey || event.altKey || event.metaKey) return
          const key = eventCodeToSkillKey(event.code)
          if (key) {
            event.preventDefault()
            choose(key)
          }
        }}>
          <div className="flex items-center gap-2 p-1 pb-0">
            <CommandInput className="flex-1" placeholder="Search keys…" />
            <Button size="sm" variant={capturing ? "default" : "outline"} onClick={() => setCapturing((active) => !active)}>
              {capturing ? "Press now…" : "Capture key"}
            </Button>
          </div>
          <CommandList>
            <CommandEmpty>No supported key found.</CommandEmpty>
            {SKILL_KEY_GROUPS.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.keys.map((key) => (
                  <CommandItem key={key} value={`${group.label} ${key}`} onSelect={() => choose(key)}>
                    <Kbd>{key}</Kbd>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
