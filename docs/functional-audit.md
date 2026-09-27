# Functional audit and implementation - 2026-09-27

Baseline: `25a6aa6`, version `1.0.12`. The initial working tree was clean. The 2026-09-26 audit identified 19 groups of functional defects; the implementation was committed in `1ba0aa3`, followed by the compact UI work in `ac63fce`. No persisted format change was introduced.

## Current state and next steps

| Area | Implemented state | Next verification |
| --- | --- | --- |
| Hold and recording lifecycle | Pending Hold releases invalidate startup; recorder commands serialize across mounts, cancel late starts, and stop on teardown/emergency | Physical quick press/release and capture/navigation matrix |
| Document safety | Saved profiles execute independently of editor contents/path; native close protects edits; synchronous operation guards prevent overlapping New/Open/Save/recovery | Alt+F4/taskbar close and native dialogs in packaged app |
| Runner truth | Session-tagged events, ordered commands/status reconciliation, finish-before-ack handling, per-session totals, explicit Reset/Stop coordination | Rapid real hotkey switches and Repeat-N runs |
| Focus stop | Generation rechecked under switch lock before stopping | Real game focus/elevation matrix |
| Hotkey registration | Canonical duplicates rejected; successful additions/removals rolled back on error; frontend updates serialized; new profiles unbound; numpad preserved | OS conflicts and physical numpad keys |
| Validation/preferences | Finite integer delays/counts and native bounds; malformed stored bindings normalized; concurrent channel key overlap rejected | Existing user combo compatibility spot-check |
| Window lifecycle | Serialized compact transitions, partial-failure restoration, physical-size preservation, startup always-on-top | 100%/150%/mixed-DPI monitor tests |
| Input failures | Injector errors propagate; worker panic/error clears channel state and emits failure; key-release guards retained | Elevated/non-elevated game injection |
| File cache and imports | Recovery invalidates cache; reads retry until stable; strict Jitbit syntax/skipped-key warnings; malformed UTF-16 rejected; regular `.JSON` files recognized | Representative external macro files |
| Maintenance | Release helper guidance corrected; Cargo resolver explicit; unused UI dependencies removed; contracts/guides/QA/ADR updated | Further bundle cleanup remains lower priority |

## Automated evidence

- `npm test -- --reporter=dot`: **302 tests passed across 28 files**, up from 276/27.
- `cargo test --workspace --locked`: **76 passed**, up from 71; one physical recorder CPU probe intentionally ignored.
- `npm run build`: strict TypeScript and production bundling passed.
- `npm run version:check`: all five version files agree on `1.0.12`.
- `git diff --check`: passed (Git reports line-ending normalization notices).
- Unused generated UI dependencies were removed. Tabs load eagerly to keep first navigation instant; the resulting main-chunk warning does not fail the build.
- `npm run tauri -- build -- --locked`: optimized Windows app, MSI, and NSIS installers built successfully. The first sandboxed attempt could not run the WiX linker; the approved unrestricted retry passed. Artifacts are under `src-tauri/target/release/bundle/{msi,nsis}/`.

Regression coverage includes Hold release during load/start, recorder teardown/start cancellation, dirty A - execute B - Save A, native close/busy guards, recovery invalidation, delayed runner status, completion before acknowledgement, stale session events/focus monitors, rejected switches, hotkey rollback/canonical conflicts, malformed numeric/preferences inputs, and compact transition failures.

## Deliberate decisions

Saved-profile execution leaves the editor untouched. Overlapping potion/skill keys are rejected rather than introducing a second key-ownership system. See [ADR 0005](decisions/0005-profile-execution-and-key-ownership.md). Historical ADRs remain unchanged. Version 4 combo serialization and older import compatibility are retained.

## Remaining release checks

The [manual QA matrix](manual-qa.md) remains unchecked where physical Windows input, game focus/elevation, native close/dialog behavior, and mixed DPI are required. Unit tests use controlled injectors/IPC and do not establish real game compatibility. No physical recorder CPU probe or live GitHub release/permission check has been performed. Installer creation alone does not prove installer execution or hosted release success. The npm dependency audit is clean, and CI checks npm and RustSec advisories.

Unused generated UI components and their dependencies were removed. Further bundle reduction remains a maintenance follow-up after physical functionality is verified. No public release was created.
