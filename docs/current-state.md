# Current project state

Last updated: 2026-09-27.

Use this file to resume work in a new conversation. Read the linked owner documents only when the next task touches them; the detailed historical handoff is in [implementation-summary-2026-09-27.md](implementation-summary-2026-09-27.md).

## Current objective

Validate the completed functional and compact-UI work on Windows, fix any reproducible failures, then prepare the normal pull-request and Release Please flow.

## Completed

- The functional audit findings were implemented across cancellation, recording, profile execution, runner sessions, native close handling, file operations, hotkeys, validation, preferences, compact mode, input injection, caching, and imports.
- The editor shell and four tabs were compacted without changing runner behavior, IPC contracts, combo schema, or persisted setting semantics.
- Maintained behavior is documented in [user-guide.md](user-guide.md), [architecture.md](architecture.md), [contracts.md](contracts.md), and [combo-file-format.md](combo-file-format.md).
- The consequential profile-execution and key-ownership decisions are recorded in [ADR 0005](decisions/0005-profile-execution-and-key-ownership.md).
- Unused generated UI primitives and seven unused UI dependencies were removed; the production CSS bundle dropped from 193.66 kB to 92.40 kB.
- Package and Rust metadata identify Lowie Dave Dichoson and the repository now carries an MIT license.
- Application version remains `1.0.12`; no release was published as part of the implementation session.

## Recorded verification

- `npm test -- --reporter=dot`: 298 tests across 28 files passed.
- `cargo test --workspace --locked`: 76 passed; one manual recorder CPU probe ignored.
- `npm run build`, `tsc --noEmit`, `npm run version:check`, and `git diff --check` passed.
- `npm run tauri -- build -- --locked` produced the Windows executable, MSI, and NSIS installer.
- These are recorded results, not a fresh verification run for this handoff.

## Next work

1. Install a generated package and run the focused checks in [manual-qa.md](manual-qa.md).
2. Prioritize Hold press/release, recording teardown, dirty A/run B/save A, Alt+F4 with edits, rapid Start/Stop, and short Repeat-N runs.
3. Test real-game input, emergency stop, focus-loss stop, and matching administrator elevation.
4. Test compact-mode restoration at 100%, 150%, and mixed-monitor DPI, including always-on-top after restart.
5. Check representative combo and Jitbit imports, physical numpad shortcuts, and OS shortcut conflicts.
6. Fix reproducible failures, rerun the relevant automated checks, and update this file.
7. After QA passes, review and commit with a Conventional Commit and use the normal PR/Release Please workflow.

## Known follow-ups

- The Vite main-chunk warning above 500 kB remains.
- Installer behavior, display scaling, real-game injection, and physical recorder behavior still require manual verification.
- `npm audit` currently reports no known vulnerabilities; CI now checks npm and RustSec advisories.
- Live GitHub release/permission verification was not performed.

## Resume prompt

In a new conversation, use:

> Continue this project. Read `AGENTS.md` and `docs/current-state.md`, inspect the working tree, and proceed with the next unfinished item.

Do not assume the working tree is clean. Preserve existing changes and use Git plus the maintained owner documents as the source of truth when this handoff becomes stale.
