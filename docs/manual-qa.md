# Manual QA checklist

Use this checklist before a release or after changes to Windows integration, layout, timing, hotkeys, files, or security policy. Record OS version, display scaling, normal/elevated status, and build commit.

## Startup and files

- [ ] Fresh storage shows the welcome dialog once.
- [ ] Help can be reopened from the sidebar without changing the current combo.
- [ ] New/Open/Save/Save As and recent files behave correctly.
- [ ] Unsaved changes prompt before destructive open/new/close actions.
- [ ] Editing shows the Unsaved badge and emphasized Save action; a successful save clears both and shows a last-save time on a wide window.
- [ ] Second save creates a readable `.bak` containing the previous version.
- [ ] A damaged primary plus valid backup offers recovery; Cancel is non-destructive and Recover restores the primary.
- [ ] Auto-load succeeds for a valid last path and degrades safely for a missing/corrupt path.

## Potions and skills editor

- [ ] Minimum 660×720 window remains usable; resizing does not clip card borders or timeline ends.
- [ ] List and Timeline show the same order and selection.
- [ ] Ctrl/Shift selection, Ctrl+A, Delete, Ctrl+D, block drag, and bulk delay operations work.
- [ ] Dragging from the row body reorders one or multiple selected steps; inputs, key pickers, and action buttons do not accidentally start a drag.
- [ ] Copy/cut/paste preserves order and assigns independent steps.
- [ ] Disabled steps appear muted, persist after reopen, and do not run.
- [ ] Disabling a matching KeyUp shows the unmatched-KeyDown warning.
- [ ] Timeline reaches and fully displays its last step when horizontally scrolled.
- [ ] Timeline start/active/end, zoom, Fit, and Follow controls work; Follow off does not pull the viewport during playback.
- [ ] Dragging the playback-speed slider changes its readout and effective duration without rewriting source delays; Reset returns to 1× and controls lock during a run.

## Recording

- [ ] 3/5/10/custom countdowns start at the configured duration.
- [ ] Escape, Cancel, and emergency stop cancel countdown without starting backend capture.
- [ ] Recording captures normal and rapid physical taps; follow [recorder-reliability.md](recorder-reliability.md).
- [ ] Stopping converts timestamps into correctly ordered Delay and key steps.
- [ ] Emergency stop during recording ends capture and leaves no stuck state.

## Hotkeys and runner

- [ ] Duplicate profile/emergency shortcuts are rejected.
- [ ] Hotkey health reports registration success/failure, conflicts, missing cycle assignments, and unavailable combo files.
- [ ] Toggle starts and stops.
- [ ] Hold starts on press and stops on release; releasing an old profile does not stop a newer profile.
- [ ] Start only ignores repeats; Stop only stops any current run.
- [ ] Cycle wraps and skips unavailable files with a warning.
- [ ] Rapid start/stop/profile switching never mixes two combos.
- [ ] Repeat N stops at the requested count.
- [ ] Header stop outcomes correctly distinguish manual, emergency, Repeat complete, focus lost, profile switch, and start failure.
- [ ] Emergency stop stops both channels and recording.

## Compact mode and visualization

- [ ] Confirm compact mode in every configured corner and `auto`.
- [ ] Compact bar is always on top, square-cornered, and fully visible.
- [ ] Expand Editor restores the window while playback continues.
- [ ] Active enabled step highlights and auto-scrolls in List and Timeline.
- [ ] Stopping clears progress and restores position, size, resize constraints, corner style, and prior always-on-top state.

## Game integration

- [ ] Injected keys reach a normal game process.
- [ ] When the game is elevated, behavior is correct after elevating the recorder too.
- [ ] Hold-right-click releases on manual stop, Repeat-N, focus auto-stop, and normal app exit.
- [ ] Auto-stop waits until the game has first been focused, ignores a transient loss, and stops after sustained loss.

## Packaged security/build

- [ ] `npm run tauri build` creates MSI and NSIS artifacts.
- [ ] Packaged app starts with the configured CSP and no console CSP violations during normal workflows.
- [ ] Dialog, global-shortcut, and window operations work with the declared capabilities.
- [ ] No workflow attempts external network access.
