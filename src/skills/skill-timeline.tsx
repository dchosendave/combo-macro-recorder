import { useEffect, useRef, useState } from "react"
import { ArrowDownToLine, ArrowUpFromLine, Clock3, Focus, LocateFixed, Minus, Plus, SkipBack, SkipForward } from "lucide-react"
import { Badge } from "@/shared/components/ui/badge"
import { Button } from "@/shared/components/ui/button"
import { Kbd } from "@/shared/components/ui/kbd"
import type { SkillStep } from "@/shared/types"
import { normalizeSkillKey } from "@/shared/skill-keys"
import { normalizePlaybackSpeed } from "@/shared/run-validation"

export type TimelineItem = { step: SkillStep; startMs: number; endMs: number }

export function buildTimeline(steps: SkillStep[], playbackSpeed = "1") {
  let elapsed = 0
  const speed = normalizePlaybackSpeed(playbackSpeed)
  const items = steps.map((step): TimelineItem => {
    const startMs = elapsed
    if (step.type === "delay" && !step.disabled) elapsed += Math.round(Math.max(0, Number(step.ms) || 0) / speed)
    return { step, startMs, endMs: elapsed }
  })
  return { items, totalMs: elapsed }
}

const MIN_TIMELINE_SCALE = 0.1
const MAX_TIMELINE_SCALE = 3

export function clampTimelineScale(scale: number) {
  return Math.min(MAX_TIMELINE_SCALE, Math.max(MIN_TIMELINE_SCALE, scale))
}

export function fitTimelineScale(totalMs: number) {
  return totalMs > 0 ? Math.min(1.5, Math.max(0.15, 640 / totalMs)) : 1
}

type SkillTimelineProps = {
  steps: SkillStep[]
  activeStepId?: string | null
  playbackSpeed?: string
}

export function SkillTimeline({ steps, activeStepId = null, playbackSpeed = "1" }: SkillTimelineProps) {
  const { items, totalMs } = buildTimeline(steps, playbackSpeed)
  const [manualScale, setManualScale] = useState(1)
  const [fitToView, setFitToView] = useState(true)
  const [autoFollow, setAutoFollow] = useState(true)
  const scale = fitToView ? fitTimelineScale(totalMs) : manualScale
  const viewportRef = useRef<HTMLDivElement>(null)

  const scrollToStep = (id: string | null | undefined, behavior: ScrollBehavior = "smooth") => {
    if (!id) return
    viewportRef.current
      ?.querySelector<HTMLElement>(`[data-step-id="${id}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "center", behavior })
  }

  useEffect(() => {
    if (!autoFollow) return
    scrollToStep(activeStepId, "auto")
  }, [activeStepId, autoFollow])

  const changeZoom = (factor: number) => {
    setManualScale(clampTimelineScale(scale * factor))
    setFitToView(false)
  }

  if (steps.length === 0) return <p className="py-3 text-xs text-muted-foreground">No steps to display.</p>

  return (
    <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col gap-2 overflow-hidden rounded-xl border bg-muted/10 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Cycle timeline</p>
          <p className="text-xs text-muted-foreground">Key events are instantaneous; delay widths represent elapsed time.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <Badge variant="outline" className="mr-1 tabular-nums">{totalMs.toLocaleString()} ms total</Badge>
          <Button type="button" variant="ghost" size="icon-xs" aria-label="Go to timeline start" title="Go to start" onClick={() => scrollToStep(items[0]?.step.id)}><SkipBack /></Button>
          <Button type="button" variant="ghost" size="icon-xs" aria-label="Go to active step" title="Go to active step" disabled={!activeStepId} onClick={() => scrollToStep(activeStepId)}><LocateFixed /></Button>
          <Button type="button" variant="ghost" size="icon-xs" aria-label="Go to timeline end" title="Go to end" onClick={() => scrollToStep(items.at(-1)?.step.id)}><SkipForward /></Button>
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
          <Button type="button" variant="ghost" size="icon-xs" aria-label="Zoom out timeline" title="Zoom out" onClick={() => changeZoom(0.8)}><Minus /></Button>
          <Button type="button" variant={fitToView ? "secondary" : "ghost"} size="xs" aria-pressed={fitToView} title="Fit the full timeline" onClick={() => setFitToView(true)}><Focus /> Fit</Button>
          <Button type="button" variant="ghost" size="icon-xs" aria-label="Zoom in timeline" title="Zoom in" onClick={() => changeZoom(1.25)}><Plus /></Button>
          <Button type="button" variant={autoFollow ? "secondary" : "ghost"} size="xs" aria-pressed={autoFollow} title="Keep the active playback step visible" onClick={() => setAutoFollow((value) => !value)}><LocateFixed /> Follow</Button>
        </div>
      </div>
      <div ref={viewportRef} className="min-h-0 min-w-0 w-full max-w-full flex-1 overflow-x-auto overflow-y-hidden pb-2">
        <div className="flex h-full w-max min-w-full items-center gap-1 pl-2">
          {items.map(({ step, startMs, endMs }) => {
            if (step.type === "delay") {
              const effectiveMs = endMs - startMs
              const width = Math.max(64, Math.min(360, effectiveMs * scale))
              return (
                <div
                  key={step.id}
                  data-step-id={step.id}
                  style={{ width }}
                  aria-current={activeStepId === step.id ? "step" : undefined}
                  className={`relative flex h-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed bg-background px-2 transition-colors ${step.disabled ? "opacity-40" : ""} ${activeStepId === step.id ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/40" : ""}`}
                >
                  {activeStepId === step.id && <span aria-hidden className="absolute -top-5 h-4 w-0.5 rounded-full bg-emerald-500" />}
                  <Clock3 className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium tabular-nums">{effectiveMs} ms</span>
                  <span className="text-[10px] text-muted-foreground">at {startMs} ms</span>
                </div>
              )
            }

            const key = normalizeSkillKey(step.key)
            return (
              <div
                key={step.id}
                data-step-id={step.id}
                aria-current={activeStepId === step.id ? "step" : undefined}
                className={`relative flex h-24 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border transition-colors ${step.disabled ? "opacity-40" : ""} ${activeStepId === step.id ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/40" : ""} ${key ? "bg-background" : "border-destructive bg-destructive/5"}`}
              >
                {activeStepId === step.id && <span aria-hidden className="absolute -top-5 h-4 w-0.5 rounded-full bg-emerald-500" />}
                {step.type === "keydown" ? <ArrowDownToLine className="size-4 text-blue-500" /> : <ArrowUpFromLine className="size-4 text-amber-500" />}
                <Kbd>{key ?? "?"}</Kbd>
                <span className="text-[10px] text-muted-foreground">{step.type === "keydown" ? "Down" : "Up"} · {startMs} ms</span>
              </div>
            )
          })}
          <div aria-hidden className="w-6 shrink-0" />
        </div>
      </div>
    </div>
  )
}
