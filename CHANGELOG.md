# Changelog

All notable changes to Hamin Macro Recorder are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

- New Settings page (sidebar item): Always on top, auto-load on startup, combo files directory, and compact-overlay corner moved out of the Hotkeys tab, which now only manages hotkey bindings.
- The current file name in the top bar is now a dropdown listing every `.json` combo in the combo directory (the one configured in the Hotkeys tab); picking one opens it through the normal unsaved-changes flow.
- Left sidebar navigation (collapsible icon rail, Ctrl+B, persisted): Combo with Potions/Skills sub-items and Hotkeys replace the stacked tab bars; the top bar now holds only contextual actions.
- Window now opens at a 16:9 default sized to ~2/3 of the screen's work-area width (1280x720 on a 1080p monitor), scaling up proportionally on larger screens.
- Recent Combos dropdown (History button in the header) listing the last 8 opened/saved combo files, with click-to-reopen through the normal unsaved-changes flow and stale entries dropped on failed reads.
- Comprehensive automated test suite: frontend pure logic + all hooks (vitest + jsdom + `@testing-library/react`, 181 tests) and backend gaps (56 Rust tests, including the hotkey diff/rollback, channel stop semantics, and error paths).
- CI workflow (`.github/workflows/test.yml`) running `npm test` + `cargo test` on `windows-latest` for every push/PR.
- Document usage in the README (features, quick start, combo file format, troubleshooting).

### Fixed

- Combo file import degrading malformed `potions`/`skills` fields to defaults instead of leaking garbage or crashing.
- `set_hotkeys` partially mutating registered shortcuts when a registration failed; it now re-registers removed keys (best-effort rollback) and returns the error without changing state.

## [1.0.7] - 2026-07-23

### Fixed

- Global hotkeys not triggering their combo reliably.

## [1.0.6] - 2026-07-22

### Fixed

- Jitbit macro import producing incorrect steps.

## [1.0.5] - 2026-07-18

### Changed

- UI/UX polish, including improved dark and light theme handling.

## [1.0.4] - 2026-07-18

### Added

- Live keyboard recording (capture keystrokes into the skill step list).
- Select-all / delete-all actions with confirmation dialog.

### Changed

- Internal source restructure (feature folders, kebab-case file names).

## [1.0.3] - 2026-07-18

### Fixed

- Release tags aligned with release names.

## [1.0.2] - 2026-07-18

### Added

- GitHub Actions workflow that builds the app and uploads a draft release on new `v*` tags.

## [1.0.0 / 1.0.1] - 2026-07-10 to 2026-07-18 (untagged)

Core app. This section is reconstructed from commit history and is approximate.

### Added

- Potion key macro (auto-press Q/W/E/R) with configurable delay and repeat counts.
- Skill combo builder with keydown/keyup/delay steps, scroll/drag reordering, and repeat-N mode.
- Multiple global hotkey profiles, each bound to a combo file (hotkey auto-naming).
- Combo files: new/open/save, auto-open the last saved combo on startup.
- Jitbit-compatible key timing and delays.
- Borderless window with custom title bar and final app branding.

### Changed

- Loop timing reworked (stable delays, no drift, immediate stop).
- Repeat counts match Jitbit/Razer Macro timing behavior.

<!--
Maintenance: add a new section for each release. Releases are created by
bumping the version (scripts/bump-version.ps1) and pushing a `v*` tag; the CI
workflow uploads the installer to a draft GitHub release.
-->
