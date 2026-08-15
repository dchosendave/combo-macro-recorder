# Testing guide

## Commands

Run from the repository root:

```powershell
npm test
npm run build
cargo test
```

`npm run build` is also the strict TypeScript check. Tests live under `src/` and are included in that program, so unused test imports fail the build.

For the desktop build path without creating installers:

```powershell
npm run tauri -- build --debug --no-bundle
```

Release bundles use `npm run tauri build` and appear under `src-tauri/target/release/bundle/`.

## Frontend suite

Vitest runs in jsdom. Pure transformation and validation logic should have direct unit tests. Hooks use `renderHook` from Testing Library.

Global Tauri, window, and Sonner mocks are in `src/test/setup.ts`. Typed handles and event dispatch are in `src/test/tauri-utils.ts`.

Hook-test rules:

- Set `invokeMock.mockResolvedValue(undefined)` or a command-specific implementation in `beforeEach`; hooks commonly chain `.catch` on invoke results.
- Wrap asynchronous state changes in `await act(async () => { ... })`.
- Use `fireTauriEvent(name, payload)`. It supplies the real `{payload}` event shape.
- Clear timers/mocks between tests; global setup performs the baseline cleanup.
- Do not add snapshot fixtures. Parser tests use inline `.mcr` strings so clean clones work.

Important executable contracts:

- `shared/run-validation.test.ts`: validation and exact frontend-to-Rust shapes.
- `combo-file/combo-io.test.ts`: format versions/default merging.
- `hotkeys/use-global-hotkeys.test.ts`: modes, cache generation, and last-press-wins races.
- `runner/use-macro-runner.test.ts`: authoritative state and session-safe progress.
- `skills/step-selection.test.ts`: ordered block editing.
- Hook suites: state application, persistence, error handling, and cleanup.

Tab components are intentionally thin integration glue and remain primarily manual QA. Extract complicated behavior into pure functions or hooks rather than building fragile component snapshots.

## Rust suite

Rust tests must run on Windows for real Win32 linkage. The root Cargo workspace and `.cargo/config.toml` intentionally target `src-tauri/target`.

`src-tauri/build.rs` embeds Common-Controls v6 into every artifact. Without it, Tauri-linked Windows test binaries can fail at load with `0xc0000139`. Do not remove or bypass it.

Backend tests use mock injectors/providers; never send real keys from normal unit tests. They cover:

- Atomic save/backup/recovery.
- Hotkey diff and rollback.
- Runner stop/start serialization.
- Key-release cleanup, including panic unwinding.
- Repeat behavior and event throttling.
- Focus-monitor generation isolation.
- Key parsing and timing cancellation.

The ignored recorder CPU probe is manual:

```powershell
cargo test recorder_idle_cpu_probe -- --ignored --nocapture --test-threads=1
```

## Regression policy

Every bug fix should first gain the smallest test that would have failed before the fix. Cross-boundary changes require tests on both serialization sides when applicable. A green unit suite does not replace the Windows checks in [manual-qa.md](manual-qa.md).

## CI

`.github/workflows/test.yml` runs frontend and Rust tests on `windows-latest` for pushes and pull requests. Publishing a `v*` tag runs the Windows release workflow and creates a draft release with installers.
