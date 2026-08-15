# User guide

Hamin Macro Recorder builds and runs potion and skill-key sequences. Real global hotkeys, recording, and injected input are Windows features.

## Start a combo

On first launch, open an existing JSON combo, create an untitled combo, or skip the welcome screen. The Help item at the bottom of the sidebar reopens a non-destructive feature guide at any time.

The header contains New, Open, Save, Save As, recent files, and Run/Stop. An **Unsaved** badge means the editor differs from the last opened or saved version. After a confirmed save, the header shows its time on wider windows.

## Potions

In **Combo → Potions**:

1. Enable the potion channel.
2. Select any of Q, W, E, and R.
3. Optionally set a custom hold duration. The minimum is 2 ms.
4. Choose Loop or Repeat N.

## Skills

In **Combo → Skills**, unlock the editor before changing steps. A combo can contain:

- KeyDown — press and hold a key.
- KeyUp — release a key.
- Delay — wait for a number of milliseconds.

The picker exposes letters, numbers, common keys, and F1–F12. Imported and previously saved punctuation, numpad keys, and F13–F24 remain supported internally.

Unsupported or empty keys block Run. A KeyDown without a later matching KeyUp shows a warning but remains runnable because intentional holds are valid.

### List and Timeline views

List view is best for exact step editing. Timeline view displays cumulative timing and proportional delay blocks. Both edit the same steps.

- Click selects one step.
- Ctrl-click toggles individual steps.
- Shift-click selects a range from the selection anchor.
- Ctrl+A selects all steps while unlocked.
- Delete removes selected steps.
- Ctrl+D duplicates the selected block.
- Ctrl+C, Ctrl+X, and Ctrl+V copy, cut, and paste steps inside the application.
- Ctrl+Up and Ctrl+Down move the selected block.

While the editor is unlocked, drag anywhere on a row's non-interactive surface to reorder it. Inputs, key pickers, and action buttons remain reserved for editing. Dragging one row in a multi-selection moves the selected rows together.

The compact selection bar opens an inspector where you can duplicate, copy, cut, paste, delete, enable/disable, or adjust selected delays. Pasted and duplicated steps receive new identities.

Timeline controls jump to the start, active step, or end; zoom in/out; or fit the whole cycle. **Follow** keeps the active playback step visible. Turn Follow off while inspecting another part of a running timeline. The green playhead marks the currently executing enabled step.

Disabled steps stay in the file and editor but are skipped during validation, duration calculation, and playback. Disabling a release may create the existing unmatched-KeyDown warning.

### Playback speed

Drag the playback-speed slider left to slow down or right to speed up, from 0.1× to 4× in 0.05× increments. The live readout and authored/effective cycle durations update as you drag; Reset returns to 1×. Playback scales copies of delay values sent to the runner and never rewrites saved step delays. Speed is locked during a run because that run keeps the value it started with.

### Recording

Record captures supported keyboard transitions system-wide. Before capture, the configurable countdown gives time to focus the game. Settings offers 3, 5, 10, or a custom 1–60 seconds. Escape, Cancel, or the emergency-stop shortcut cancels a pending countdown.

Stopping recording converts timestamp differences into Delay steps. Modifier keys such as Shift, Ctrl, and Alt are intentionally not recorded.

## Save and recovery

Save writes JSON atomically: the app syncs a sibling temporary file and replaces the primary file. Once a file already exists, its previous good contents are retained as `<file>.bak`.

If opening the primary file fails and the backup is valid, the app offers recovery. Confirming recovery replaces the damaged primary while retaining a usable backup. Cancel leaves files unchanged.

## Hotkeys

Each named profile has a shortcut, run mode, and combo-file assignment:

- **Toggle** — start when stopped; stop when running.
- **Hold** — run while the shortcut is held; releasing stops only that profile’s run.
- **Start only** — starts but never stops.
- **Stop only** — stops the current macro.
- **Cycle** — advances through an ordered list of combo files and wraps.

Cycle mode skips unavailable files and warns. A shortcut cannot conflict with another profile or the emergency-stop shortcut. The Hotkeys page reports registration progress/failure, conflicts, unavailable assigned files, and each profile's readiness.

## Running and stopping

Run validates the enabled channels and waits for backend confirmation. The window then enters a compact always-on-top bar. Use its Expand Editor button to keep playback running while viewing the active List or Timeline step. Progress highlighting is visual-only and does not alter playback timing.

Stop from the compact bar, the configured hotkey mode, the main header, or the optional emergency-stop shortcut. Emergency stop is intentionally unset until configured in Settings.

After stopping, the header identifies the last outcome: manual, emergency, Repeat complete, focus lost, profile switched, or start failed.

Auto-stop can watch a selected game process. After that game has been focused once, losing focus for the grace period stops both channels.

## Settings

Settings contains:

- Compact-overlay corner.
- Auto-load last combo.
- Always on top.
- Recording countdown.
- Emergency-stop shortcut.
- Auto-stop game process.
- Combo directory used by file pickers.

## Troubleshooting

- If injected keys do not reach an elevated game, run the recorder as administrator too. Windows UIPI blocks a lower-privilege process from injecting into a higher-privilege process.
- If a hotkey fails to register, check profile and emergency-shortcut conflicts and shortcuts owned by other applications.
- If recording misses physical taps, use the procedure in [recorder-reliability.md](recorder-reliability.md) before changing polling behavior.
- On Wayland/Linux, global shortcuts and synthetic input may be blocked by the operating system. Validate real behavior on Windows.
