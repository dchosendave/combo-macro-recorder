# AGENTS.md

Tauri 2 + React 19 + TypeScript desktop app ("Hamin Macro Recorder") for auto-pressing QWER potion/skill keys (MU Online). Frontend in `src/`, Rust backend in `src-tauri/`.

## Commands

- `npm run tauri dev` — run the full app (spawns `vite` + cargo). Requires Rust MSVC toolchain + VS C++ Build Tools.
- `npm run tauri build` — distributable to `src-tauri/target/release/bundle/` (MSI + NSIS on Windows).
- `npm run build` — `tsc && vite build`; this is the typecheck step (`strict` + `noUnusedLocals` on, so unused imports fail it). Test files live inside `src/` and are part of the same tsc program — keep test imports clean too. There is no lint or format tooling configured.
- `cargo test` / `cargo build` work from the **repo root** or `src-tauri/` — the root `Cargo.toml` is a virtual workspace (`members = ["src-tauri"]`), and `.cargo/config.toml` pins the target dir to `src-tauri/target` (docs reference `src-tauri/target/...` paths). Don't remove either file.
- `npm test` / `npm run test:watch` — vitest (jsdom environment via `vitest.config.ts`).

## Testing

- The vitest suite is the behavioral spec: pure logic (`src/shared/*`, `combo-io`, parsers, recorder conversion) plus every hook via `renderHook` from `@testing-library/react`. Tab components stay manual QA — they're thin glue.
- Global Tauri/sonner mocks live in `src/test/setup.ts`; typed accessors and event dispatch in `src/test/tauri-utils.ts` (`invokeMock`, `listenMock`, `toastMock`, `fireTauriEvent`). Hook tests MUST set `invokeMock.mockResolvedValue(undefined)` in `beforeEach` (hooks chain `.catch` on `invoke` results) and wrap async flows in `await act(async () => { ... })`. `fireTauriEvent` wraps the payload as `{ payload }` — handlers read `event.payload`.
- `src/skills/parsers.test.ts` uses inline `.mcr`-style fixtures (no external files), so the suite runs on a fresh clone. The old `macros/` fixture dir and `__snapshots__/` are gitignored leftovers — don't re-add them, and don't introduce new snapshot-based tests (they can't be committed).
- Rust tests must run on Windows. `src-tauri/build.rs` embeds a Common-Controls v6 manifest into every artifact — without it, tauri-linked test binaries crash at load with `0xc0000139` because `comctl32!TaskDialogIndirect` only exists in the WinSxS v6 copy that manifests activate (tauri-apps/tauri#13419). Don't remove that block. The app binary itself gets an identical manifest from tauri-build.
- CI: `.github/workflows/test.yml` runs `npm test` + `cargo test` on `windows-latest` for every push/PR.

## Versioning / release

Release Please derives SemVer bumps from Conventional Commits on `main` and maintains a release PR. Merging that PR creates a forced `v*` tag plus a draft GitHub release; `.github/workflows/release.yml` then verifies, tests, builds, and uploads the Windows installers. Versions must agree across `package.json`, both lockfiles, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`; CI enforces this with `npm run version:check`. For an emergency local bump, use `scripts/bump-version.ps1 <ver>` (bash equivalent: `bump-version.sh`), which updates all five locations. Prefer `feat:`, `fix:`, and `feat!:`/`BREAKING CHANGE:` commits so automatic minor, patch, and major bumps are correct.

## Architecture

- `src/` is organized by feature: `app/`, `combo-file/`, `hotkeys/`, `potions/`, `recorder/`, `runner/`, `skills/`, `shared/`. File names are **kebab-case** (recent convention change; keep it).
- `@/*` aliases to `src/*`. UI primitives live in `src/shared/components/ui/` and use the new **`@shadcn/react` + Base UI stack, not Radix**.
- Rust: lib crate is named `combo_macro_recorder_lib` — the `_lib` suffix is a required Windows cargo workaround, don't rename. `src-tauri/src/lib.rs` is the authoritative registration list for every Tauri command.
- `src-tauri/src/runner/` runs the macro loops (potions/skills channels); `start_combo` swaps channels under a `switch_lock` so stop/start never interleaves.
- Start at `docs/README.md`. Read `docs/architecture.md` before changing ownership/run paths, `docs/contracts.md` before changing cross-boundary data, and `docs/combo-file-format.md` before changing persisted combo fields.

## Platform gotchas

- Real key injection (`enigo`, SendInput) and global hotkeys work **only on Windows**; on Wayland/Linux they're OS-blocked. If the target game runs elevated, the app must run as administrator too (UIPI).
- Global shortcuts → Rust plugin handler emits `macro-hotkey {hotkeyId,state}` → frontend subscribes (`src/hotkeys/use-global-hotkeys.ts`). Preserve press/release semantics when adding modes.
- Window is borderless (`decorations: false`, min 660x720) with a custom title bar in `src/app/title-bar.tsx`; drag region handled in CSS.

## Change impact map

| When changing | Also inspect and update |
|---|---|
| Skill-step schema | shared types/defaults, combo I/O, validation, runner inputs, both editors, Rust serde boundary, format docs |
| Tauri command | Rust implementation/registration, frontend invoke, mocks/tests, `docs/contracts.md` |
| Tauri event | emitter, listener/unlisten, payload test, session ordering, `docs/contracts.md` |
| Hotkeys | persistence migration, registration diff/rollback, modes, emergency conflicts, user guide |
| Runner state | session IDs, frontend command queue, compact mode, stop cleanup, ADR 0001 |
| Combo format | version/import compatibility, dirty baseline, recovery, tests, format docs, ADR |
| Recorder keys | picker vs internal vocabulary, normalizer, recorder, parser, injector, reliability QA |
| UI layout | 660x720 minimum, collapsed sidebar, overflow endpoints, manual QA |
| Tauri plugin/permission | capabilities, Rust/frontend dependencies, CSP/security docs, packaged build |

## Documentation policy

- User-visible behavior changes update `docs/user-guide.md`.
- Commands, events, wire shapes, and storage keys update `docs/contracts.md`.
- Persisted schema changes update `docs/combo-file-format.md` and require migration tests.
- Manual-only behavior updates `docs/manual-qa.md`.
- Consequential tradeoffs get an ADR under `docs/decisions/`.
- Avoid duplicating detailed contracts in README or AGENTS; link to the owner.
