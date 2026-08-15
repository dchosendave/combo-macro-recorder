# Hamin Macro Recorder

A Tauri 2 + React 19 desktop app for building, recording, and globally triggering potion and skill-key macros for MU Online. Real recording, global shortcuts, and input injection target Windows.

## Features

- Q/W/E/R potion channel with custom timing and Loop or Repeat N.
- Skill List and Timeline editors with selection, reorder, copy/cut/paste, bulk delays, disabled steps, undo/redo, and playback speed.
- System-wide recording with a configurable countdown.
- Jitbit Macro Recorder import.
- Named hotkey profiles with Toggle, Hold, Start only, Stop only, and Cycle modes.
- Optional independent emergency-stop shortcut and focus-loss auto-stop.
- Atomic combo saves, previous-version backups, explicit recovery, recent files, and auto-load.
- Compact always-on-top running bar with stop/expand controls and active-step visualization.
- Replayable in-app Help, light/dark themes, and a borderless custom window.

## Quick usage

1. Create or open a combo JSON file.
2. Configure **Combo → Potions** and/or **Combo → Skills**.
3. Build steps manually, import Jitbit text, or record physical key presses.
4. Save the combo.
5. Create a Hotkeys profile, choose its mode, and assign the combo file.
6. Focus the game and use the shortcut. Use the compact bar, a Stop-only profile, or the optional emergency shortcut to stop safely.

The Help item at the bottom of the sidebar provides an always-available feature refresher. The complete workflow is in the [user guide](docs/user-guide.md).

## Combo files

New files use JSON format version 4. Versions 2 and 3 remain accepted. Version 4 supports persisted disabled steps and non-destructive playback speed. See the [format specification](docs/combo-file-format.md) for the schema, examples, defaults, and migration rules.

## Documentation

Start at the [documentation index](docs/README.md). It links the user guide, architecture, integration contracts, testing, manual QA, security model, and architectural decisions.

## Windows prerequisites

- Rust stable with the `x86_64-pc-windows-msvc` toolchain.
- Visual Studio C++ Build Tools with **Desktop development with C++**.
- WebView2 runtime.
- Node.js and npm.

```powershell
npm install
npm run tauri dev
```

Build installers with:

```powershell
npm run tauri build
```

Artifacts are written to `src-tauri/target/release/bundle/`.

## Testing

```powershell
npm test
npm run build
cargo test
```

See [testing.md](docs/testing.md) and [manual-qa.md](docs/manual-qa.md).

## Platform notes

If the target game runs as administrator, run the recorder as administrator too; Windows UIPI blocks lower-integrity input injection. Wayland/Linux commonly blocks global shortcuts and synthetic input, so validate real behavior on Windows.

## Recommended IDE setup

VS Code with the Tauri extension and rust-analyzer.
