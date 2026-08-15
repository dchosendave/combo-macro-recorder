# Security model

Hamin Macro Recorder is a local desktop application with powerful global-input behavior. Its principal risks are unintended file access, excessive WebView privileges, stuck injected keys, shortcut collisions, and Windows privilege boundaries.

## Trust boundaries

- React/WebView owns editable UI state and requests native operations through explicit Tauri commands/plugins.
- Rust owns filesystem operations, global shortcut registration, recording, process enumeration, runner state, and input injection.
- Combo and Jitbit files are untrusted local input. Parsers must reject unsupported versions/commands or degrade malformed optional fields safely.
- The target game is external and may run at a higher integrity level.

## Content Security Policy

`src-tauri/tauri.conf.json` defines an explicit CSP. It defaults resources to the application origin, permits Tauri IPC endpoints, local asset/data fonts and images, inline styles required by the UI stack, and the Vite development endpoint. It does not grant arbitrary remote script or network origins.

When adding a resource:

1. Prefer bundling it locally.
2. Add the narrowest directive only if required.
3. Never add `unsafe-eval` without a documented security review.
4. Exercise the packaged app and inspect CSP violations.

## Tauri capabilities

`src-tauri/capabilities/default.json` scopes permissions to the main window. Current needs are native dialogs, global-shortcut lifecycle, and the window operations used by the title bar/compact mode. The unused opener plugin and permission were removed.

New plugins require all of:

- A concrete user-facing need.
- Minimal capability permissions.
- Frontend usage and error handling.
- Contract/security documentation.
- Removal when no longer used.

## Files

- Paths originate from native dialogs, configured combo directories, recent paths, or explicit hotkey profiles.
- Save is atomic and retains a previous sibling backup.
- Recovery requires confirmation and uses the known primary/backup pair.
- Jitbit import accepts text only and rejects unsupported mixed commands rather than silently executing them.
- Combo JSON is data; it is never evaluated as script.

Do not broaden commands into arbitrary shell execution or URL opening. Resolve and validate destructive targets before changing filesystem behavior.

## Global input and cleanup

Runner channels own atomic running flags and joinable threads. `KeyReleaseGuard` releases known keys and right-click on normal completion, cancellation, and Rust panic unwinding. App exit calls `stop_all_inner`. A hard process kill cannot run cleanup, which is why an independently configurable emergency shortcut remains valuable during normal operation.

Recording polls keyboard state but intentionally ignores modifier keys. Recorded input remains in memory until converted into editable steps; the app does not transmit it.

## Elevation

Windows UIPI prevents a normal-integrity recorder from injecting into an elevated game. The supported response is to run the recorder at the same integrity level—not to bypass UIPI. Elevation increases impact, so keep file/plugin capabilities narrow.

## Dependency and release review

Before release:

- Review `package.json`, Cargo dependencies, Tauri plugins, and declared permissions for unused entries.
- Run frontend/Rust tests and a Tauri build.
- Complete packaged checks in [manual-qa.md](manual-qa.md).
- Confirm no secrets, telemetry, remote URLs, or unexpected network requests were introduced.
- Document any new trust boundary or permission here.
