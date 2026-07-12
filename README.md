# Hamin Macro Recorder

A Tauri + React + TypeScript desktop app for auto-pressing QWER potion keys (targeting MU Online).

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

> **Note:** If the target game runs as administrator, run this app as administrator
> too, otherwise Windows (UIPI) blocks input injection into it.

## Linux (development notes)

The UI and macro loop logic run on Linux, but on **Wayland** synthetic key injection
and global hotkeys are blocked by the OS. Use the on-screen START/STOP button to test
the loop logic (the dev visualizer shows the key sequence). Real injection and global
hotkeys should be validated on Windows.

If using the X11 (`xdo`) path, install the runtime deps on Fedora:

```bash
sudo dnf install libX11-devel libxdo-devel
```
