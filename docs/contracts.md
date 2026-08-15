# Integration contracts

This file owns cross-boundary contracts. When a payload changes, update the emitter/caller, receiver, mocks, tests, and this document together. JSON fields are camelCase unless noted.

## Tauri commands

All commands are registered in `src-tauri/src/lib.rs`.

| Command | Arguments | Return | Frontend owner |
| --- | --- | --- | --- |
| `start_combo` | `{autoStop, potions, skills}`; channels may be `null` | `RunnerStatus` | `runner/use-macro-runner.ts` |
| `stop_all` | none | `RunnerStatus` | `runner/use-macro-runner.ts` |
| `get_runner_status` | none | `RunnerStatus` | `runner/use-macro-runner.ts` |
| `save_file` | `{path, content}` | `()` | `combo-file/use-combo-file.ts` |
| `read_file` | `{path}` | UTF-8 string | combo file hooks/hotkey cache |
| `read_backup_file` | `{path}` | UTF-8 string | recovery flow |
| `restore_backup_file` | `{path}` | `()` | recovery flow |
| `read_jitbit_file` | `{path}` | decoded string | Skills import |
| `list_combo_files` | `{path}` | `{name,path}[]` | combo directory picker |
| `set_hotkeys` | `{hotkeys: {shortcut,hotkeyId}[]}` | `()` | `hotkeys/use-global-hotkeys.ts` |
| `start_recording` | none | `()` | `recorder/use-recorder.ts` |
| `stop_recording` | none | `RecordedEvent[]` | `recorder/use-recorder.ts` |
| `set_hard_corners` | `{enabled}` | `()` | compact mode |
| `list_processes` | none | `ProcessInfo[]` | Settings process picker |

`RunnerStatus` is `{sessionId, potionsRunning, skillsRunning}`. Session zero means fully stopped. A successful start with at least one channel receives a monotonically increasing backend-issued session ID.

`RecordedEvent` is `{timestampMs, key, action}`, where action is `keydown` or `keyup` and timestamps are monotonic milliseconds from recording start.

## Events

| Event | Direction | Payload | Semantics |
| --- | --- | --- | --- |
| `macro-hotkey` | Rust → UI | `{hotkeyId,state: "pressed"|"released"}` | One per registered shortcut transition |
| `macro-activation` | Rust → UI | `{channel,cycle}` | Potion events every 10 cycles; skills every cycle |
| `macro-step` | Rust → UI | `{sessionId,stepIndex}` | Enabled skill-step index, capped near 60 Hz |
| `macro-finished` | Rust → UI | `{channel,cycle,reason:"repeat-complete"}` | Repeat-N completion only |
| `macro-auto-stopped` | Rust → UI | `{reason:"focus-lost"}` | Focus monitor stopped both channels |
| `macro-emergency-stop` | UI DOM event | no payload | Cancels recording/countdown after emergency stop |

The editor maps `macro-step.stepIndex` over enabled steps, not the original array. It displays progress only when the event session equals current `RunnerStatus.sessionId`. Progress is advisory and must never control injection.

## Runner input wire shapes

`derivePotionRun` and `deriveSkillRun` in `src/shared/run-validation.ts` are the sole conversion boundary. The Rust backend receives numbers, not input strings:

```ts
type PotionsRunConfig = {
  keys: Record<"q" | "w" | "e" | "r", boolean>
  delayMs: number
  repeatMode: "loop" | "count"
  repeatCount: number
}

type SkillsRunConfig = {
  holdRightClick: boolean
  steps: Array<
    | { type: "keydown" | "keyup"; key: string }
    | { type: "delay"; ms: number }
  >
  repeatMode: "loop" | "count"
  repeatCount: number
}
```

Disabled steps are removed before analysis and conversion. Playback speed scales converted delay copies. IDs and `disabled` never cross into the runner.

## Validation invariants

- Potion minimum delay: 2 ms.
- Repeat count: 1–999999.
- Playback speed: clamped to 0.1–4×.
- Skills require at least one enabled KeyDown.
- Empty/unsupported enabled key steps block running.
- Enabled KeyDown without a later enabled KeyUp warns but does not block.
- Live editor and file-loaded hotkey runs must both use the shared derivations.

## localStorage

| Key | Value |
| --- | --- |
| `combo-macro-settings` | v3 hotkey persistence object |
| `combo-macro-last-path` | last successfully opened/saved path |
| `combo-macro-auto-load` | `"false"` disables automatic last-file loading |
| `combo-macro-combo-dir` | directory used to list combo JSON files |
| `combo-macro-always-on-top` | boolean string |
| `combo-macro-compact-corner` | `auto`, `top-right`, `top-left`, `bottom-right`, or `bottom-left` |
| `combo-macro-recent-files` | JSON string array, maximum eight |
| `combo-macro-auto-stop` | `{enabled,gameProcess}` |
| `combo-macro-emergency-hotkey` | optional shortcut; absence means unset |
| `combo-macro-record-countdown` | integer seconds from 1–60, default 3 |
| `combo-macro-skill-editor-view` | `list` or `timeline` |
| `combo-macro-tutorial-seen` | `"1"` after dismissing the welcome dialog |

Corrupt preference values must degrade to defaults rather than prevent startup.

## Coordinated-change checklist

- Command: Rust implementation and registration, invoke caller, mocks, hook test, command table.
- Event: emitter, listener, payload type, event test, cleanup/unlisten, event table.
- Runner wire type: shared derivation, exact-shape test, Rust serde type/test.
- Storage: loader fallback, writer, reset/migration behavior, persistence tests, storage table.
- Skill key: picker visibility, internal normalization, recorder name, Jitbit parser, Rust injector.
