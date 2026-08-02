# Hamin Macro Recorder

A Tauri + React + TypeScript desktop app that auto-presses potion and skill keys on a timer (targeting MU Online). Combos are built visually or imported from Jitbit Macro Recorder, then triggered by a global hotkey that works while the game is focused.

## Features

- **Potion keys** — toggle any of the Q/W/E/R potion keys, with an optional custom delay and Loop or Repeat-N mode.
- **Skill combo builder** — a step list of keydown/keyup/delay actions with reorder, duplicate, undo/redo, step label styles, and Loop/Repeat-N modes.
- **Live recording** — press Record, play the combo in the game, and the keystrokes are captured into the step list (Windows only).
- **Jitbit import** — paste a Jitbit Macro Recorder script to convert it into a skill combo.
- **Global hotkeys** — multiple named hotkey profiles, each bound to a key and a combo file; pressing the hotkey anywhere starts/stops that combo.
- **Combo files** — save/open combos as JSON, auto-load the last file on startup, with unsaved-changes protection.
- **Compact overlay** — while a combo runs, the window collapses into a small always-on-top overlay with elapsed time, activation count, and a stop control (corner configurable).
- **Dark/light themes**, borderless window with custom title bar.

## Quick usage

1. Launch the app and create a new combo (or open an existing `.json` file).
2. In the **Combo → Potions** tab, toggle which potion keys to press.
3. In the **Combo → Skills** tab, build the skill sequence (or record it live, or paste a Jitbit script).
4. Save the combo file (Save button in the toolbar).
5. In the **Hotkeys** tab, add a profile, pick a hotkey, and attach the combo file.
6. Focus the game and press the hotkey to start; press it again to stop.

## Combo file format

Combos are plain JSON with a `version` field, currently `3`:

```json
{
  "version": 3,
  "potions": { "enabled": true, "keys": { "q": true, "w": true, "e": false, "r": false }, "...": "..." },
  "skills": { "enabled": true, "steps": [{ "type": "keydown", "key": "1" }, { "type": "delay", "ms": "120" }, { "type": "keyup", "key": "1" }], "...": "..." }
}
```

Older versions are migrated automatically on import.

## Architecture

For a deep dive into how the app is wired together — command/event contracts, the
runner's channel model and timing, recording internals, persistence keys, and
platform constraints — see [`docs/architecture.md`](docs/architecture.md).

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Building & running on Windows

Key injection and global hotkeys work fully on Windows (via Win32 `SendInput` and
`RegisterHotKey`). To build/run there:

### 1. Install prerequisites

1. **Rust (MSVC toolchain)** — install via [rustup](https://rustup.rs/). Accept the
   default `x86_64-pc-windows-msvc` toolchain.
2. **Visual Studio C++ Build Tools** — download the
   [Build Tools for Visual Studio](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   and install the **"Desktop development with C++"** workload.
3. **WebView2 runtime** — preinstalled on Windows 11. On Windows 10, install the
   [Evergreen WebView2 runtime](https://developer.microsoft.com/microsoft-edge/webview2/).
4. **Node.js** — install the LTS release from [nodejs.org](https://nodejs.org/).

### 2. Get the code and dependencies

```powershell
git clone <your-repo-url>
cd combo-macro-recorder
npm install
```

### 3. Run in development

```powershell
npm run tauri dev
```

### 4. Build a distributable

```powershell
npm run tauri build
```

The installer/executable is written to `src-tauri/target/release/bundle/`.

## Linux (development notes)

The UI and macro loop logic run on Linux, but on **Wayland** synthetic key injection
and global hotkeys are blocked by the OS. Use the on-screen START/STOP button to test
the loop logic (the dev visualizer shows the key sequence). Real injection and global
hotkeys should be validated on Windows.

If using the X11 (`xdo`) path, install the runtime deps on Fedora:

```bash
sudo dnf install libX11-devel libxdo-devel
```

## Troubleshooting

- **Hotkeys or key injection don't reach the game.** If the target game runs as administrator, run this app as administrator too — otherwise Windows (UIPI) blocks input injection into it.
- **Recorded steps come out empty.** Recording polls `GetAsyncKeyState` (Windows only) and works regardless of which window has focus; if nothing was captured, the keys may have been pressed during the 1 ms poll window or were modifier keys (Ctrl/Alt/Shift are intentionally skipped).
