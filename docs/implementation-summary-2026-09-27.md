# Functional audit and implementation summary

Date: 2026-09-27. Application: Hamin Macro Recorder, Tauri 2 + React 19 + TypeScript with a Rust backend.

This is a historical handoff of the audit and implementation completed in this session. For maintained behavior and contracts, use the linked owner documents below.

## Request and scope

The initial request was to scan the codebase and Markdown documentation, identify existing bugs and unfinished work, refresh stale documentation, and provide a concise functionality-first improvement table. After the audit, implementation of the findings was authorized.

The starting baseline was commit `25a6aa6`, application version `1.0.12`, with a clean working tree. The audit identified 19 groups of functional findings. Work focused on cancellation, document safety, runner consistency, validation, native window behavior, and error handling. No visual redesign or persisted combo schema change was introduced.

## Implemented changes

| Area | Problem found | Implemented behavior |
| --- | --- | --- |
| Hold hotkeys | Releasing during file loading or startup could leave a macro running | Pending ownership is tracked before awaiting startup; release cancels the pending intent and requests stop |
| Recording | Capture could outlive the Skills tab, and a late startup acknowledgement could defeat emergency cancellation | Native recorder commands serialize across mounts; teardown and emergency cancellation stop active or pending capture; duplicate starts are guarded |
| Saved profiles | Running B while editing A could replace A's editor contents without changing its save target | Profile files supply execution inputs directly; A's contents, dirty baseline, and path stay intact |
| Runner reconciliation | Delayed mount status, old events, or rejected starts could hide or overwrite an active run | Commands are queued; status reconciliation observes request ordering; errors query backend truth rather than blindly clearing state |
| Session events | Completion/focus events lacked session identity, and very short runs could finish before startup acknowledged | Runner events carry session IDs; listeners are ready before startup; terminal events received before acknowledgement remain authoritative |
| Focus monitor | A stale monitor could stop a newer run after a profile switch | Monitor generation is rechecked while holding the switch lock immediately before stopping |
| Native close | Alt+F4 and taskbar Close bypassed the custom dirty-document check | Native close requests share discard protection; close is blocked during file operations; confirmed discard is allowed once, with failure resetting that permission |
| File lifecycle | New/Open/Save/recovery could overlap and complete into the wrong document | A synchronous busy guard prevents competing document operations; recovery also invalidates the hotkey file cache |
| Hotkey registration | Partial failures left additions registered, unregister errors were ignored, and duplicate shortcuts were ambiguous | Changes are serialized; canonical duplicates are rejected; successful additions/removals are rolled back on error, and rollback failures are reported |
| Profile defaults and numpad | New profiles reused F5, and numpad shortcuts collapsed to top-row digits | Added profiles start unbound; numpad identity is retained through conversion and backend parsing; conflict comparisons normalize shortcuts |
| Numeric validation | NaN, infinity, fractional counts, and excessive delays could reach incompatible Rust inputs | Shared conversion validates finite integers; Rust validates bounds before replacing a run; timer conversion has a safe upper bound |
| Preferences | Valid JSON with malformed binding fields could break startup | Stored bindings normalize field types, repair missing/duplicate IDs, filter path arrays, and retain a usable fallback; recent paths are filtered and capped |
| Always on top | The stored switch could appear enabled without applying the native preference after restart | App startup applies the saved preference; toggles persist only after the native operation succeeds |
| Reset and Stop | Reset bypassed runner coordination; controls could reflect editor settings instead of actual channels | Reset awaits the shared stop flow; Stop remains available for an active run; compact indicators use authoritative channel state |
| Compact window | Stop during entry could leave a stopped app compact; partial failures and physical/logical size mixing broke restoration | Transitions serialize; partial entry failure attempts restoration; original physical size, position, constraints, and topmost state are restored in order |
| Injection failures | Initialization/input errors were discarded, and worker panics could leave running flags set | Errors propagate; worker error/panic clears channel state and reports an injection-failure event; release guards still run |
| Channel overlap | One channel's cleanup could release Q/W/E/R held by the other | Native startup rejects shared potion/skill keys before replacing an existing run |
| Cache and counters | No-file actions missed cancellation, cache retries covered only one invalidation, and totals could carry across sessions | All stop intents cancel pending profile loads; reads retry until the cache generation is stable; elapsed/cycle state resets per session and uses final completion totals |
| Jitbit and file listing | Numeric prefixes were accepted, unsupported keys disappeared silently, malformed UTF-16 was truncated, and listings mishandled `.JSON` | Import checks full supported row syntax and reports skipped keys; odd-length UTF-16 is rejected; listings require regular files and accept case-insensitive JSON extensions |

### Runtime and maintenance improvements

- Skill activation events are throttled near 60 Hz, like progress events, to reduce WebView event traffic in fast loops.
- Skills, Hotkeys, and Settings tabs load on demand. The initial JavaScript chunk decreased from approximately 743 kB to 553 kB uncompressed. The 500 kB build warning remains.
- The Cargo workspace explicitly uses resolver 2. The root workspace and target-directory configuration were retained.
- Both version-bump helpers now print guidance matching the Release Please/manual rebuild workflow instead of recommending tag pushes as the packaging trigger.
- Existing dependencies and UI primitives were not broadly removed; that cleanup remains lower priority than physical functionality verification.

## Design and compatibility decisions

Saved-profile playback is independent of the editor document. To edit B, explicitly open B; executing B does not replace the current document. Progress from a saved profile is not drawn over unrelated editor steps.

Overlapping potion/skill keys are rejected rather than adding shared key ownership. Existing combos using the same Q/W/E/R key in both enabled channels must remove that overlap. These decisions are recorded in [ADR 0005](decisions/0005-profile-execution-and-key-ownership.md).

Combo format v4 and older supported import compatibility remain unchanged. The application version remains `1.0.12`; no version bump, commit, push, or release publication was performed.

## Compact UI follow-up

After the functional implementation, the editor shell and all four tabs were
refined against Jitbit Macro Recorder as a density and workflow reference. The
goal was not to copy its dated styling, but to make recording, reviewing, and
running a short combo possible without navigating a large dashboard.

| Area | Previous UI | Implemented UI |
| --- | --- | --- |
| Window | Startup forced a responsive 16:9 window as large as `1280×720`, with a `660×720` minimum | Compact `860×620` default and `700×560` minimum, clamped to the monitor work area |
| Navigation | Collapsible left sidebar with a Combo parent and Potions/Skills children | One static horizontal row: Potions, Skills, Hotkeys, Settings, and Help |
| Header | Separate icons for every file operation | Run/Stop stays visible; New/Open/Save/Save As/recent files are grouped under File |
| Scrolling | The WebView document could scroll the entire app into blank space | Root height and overflow are locked; only explicit content regions scroll |
| Skills editor | Playback and repeat controls permanently consumed editor height; rows were tall | Compact rows, inline channel switches, Playback popover, and the step list receives remaining height |
| Step dragging | Whole-row dragging existed but the handle implied a handle-only target | Non-interactive row space has grab feedback; inputs/buttons remain protected; drag state and insertion feedback are clearer |
| Potions | Q/W/E/R used a two-column grid and generous vertical spacing | All four keys share one compact row with tighter duration/repeat controls |
| Hotkeys | Every profile displayed its assignment editor | Only the selected profile expands; other profiles remain summarized |
| Settings | One long list inside nested cards with a narrow process picker | Flat two-column Window & files / Automation layout, full-width Safety section, dividers, and a wider two-line searchable process picker |
| Visual hierarchy | Nested page cards, mixed content sizes, and pill shapes on most controls | Flat tab surfaces, consistent 13 px content type, soft rectangles for actions/inputs, and pills reserved for state |

No runner behavior, IPC contract, combo schema, or persisted setting semantics
changed during this UI follow-up. User behavior and the new layout checks are
maintained in [user-guide.md](user-guide.md) and [manual-qa.md](manual-qa.md).

The final UI validation in this follow-up passed `npm run build`, **298 frontend
tests across 28 files**, and `git diff --check`. The existing Vite warning for the
main JavaScript chunk above 500 kB remains. Visual checks in the packaged Windows
WebView, display scaling, installer QA, and real-game input QA remain manual work.

## Documentation work

The Markdown review covered root documentation, guides under `docs/`, and existing ADRs. Historical ADRs and released changelog entries were preserved.

| Document | Updates |
| --- | --- |
| [Functional audit](functional-audit.md) | Findings converted into implementation status, automated evidence, and remaining verification |
| [Architecture](architecture.md) | Profile/editor ownership, cancellation, sessions, focus locking, error propagation, compact restoration, and event throttling |
| [Contracts](contracts.md) | Session-tagged payloads, injection failures, stop intent, numeric bounds, preferences, and registration behavior |
| [User guide](user-guide.md) | Safe profile playback, recording cancellation, close/file safeguards, input restrictions, and failure outcomes |
| [Manual QA](manual-qa.md) | Regression scenarios for document safety, capture, Hold release, native close, and Windows behavior |
| [Testing](testing.md) and [AGENTS.md](../AGENTS.md) | CI scope and operational guidance aligned with repository workflows |
| [Combo file format](combo-file-format.md) | Example identities corrected without changing the schema |
| [Security](security.md) | Native file-command scope and the WebView-dependent emergency shortcut clarified |
| [Development workflow](development-workflow.md) | Version helper guidance aligned with release automation |
| [Changelog](../CHANGELOG.md) | Unreleased functional fixes recorded |
| [Documentation index](README.md) and [ADR index](decisions/README.md) | Audit, summary, and new decision made discoverable |

## Verification performed

These are the results recorded during implementation; documentation-only handoff work does not imply another full test run.

| Check | Result |
| --- | --- |
| Initial frontend baseline | 276 tests across 27 files passed |
| Final frontend suite: `npm test -- --reporter=dot` | **302 tests across 28 files passed** |
| Initial Rust baseline | 71 tests passed; one manual probe ignored |
| Final Rust suite: `cargo test --workspace --locked` | **76 passed; one manual recorder CPU probe ignored** |
| `npm run build` | Strict TypeScript and production bundling passed |
| Final `tsc --noEmit` | Passed |
| `npm run version:check` | All five version files agree on `1.0.12` |
| `git diff --check` | Passed |
| Relative documentation links | No missing targets found during the documentation check |
| `npm run tauri -- build -- --locked` | Optimized Windows application, MSI, and NSIS installers built successfully |

Regression coverage includes Hold release during loading/startup, recorder teardown and emergency-start races, dirty A followed by execution of B and Save A, native close and busy guards, recovery invalidation, delayed runner status, completion before acknowledgement, stale session/focus events, rejected switches, hotkey rollback and aliases, malformed inputs/preferences, import errors, and compact transition failures.

The first packaging attempt compiled the application but could not run the WiX linker under the sandbox. The approved unrestricted retry produced both installers successfully.

### Build artifacts

Artifacts are generated locally and are not source changes:

```text
src-tauri/target/release/combo-macro-recorder.exe
src-tauri/target/release/bundle/msi/Hamin Macro Recorder_1.0.12_x64_en-US.msi
src-tauri/target/release/bundle/nsis/Hamin Macro Recorder_1.0.12_x64-setup.exe
```

## Remaining work and recommended order

Automated tests use mocked IPC and controlled injectors. Building an installer does not establish that it installs correctly or that real game input works. No successful manual test results have been reported in this conversation.

1. Install a generated package and follow the [manual QA checklist](manual-qa.md).
2. Prioritize quick Hold press/release, leaving Skills during recording, dirty A/run B/Save A, Alt+F4 with edits, rapid Start/Stop, and short Repeat-N runs.
3. Verify real game injection, emergency stop, focus-loss stop, and matching elevation when the game runs as administrator.
4. Verify compact entry/restoration at 100%, 150%, and mixed monitor DPI, plus always-on-top after restart.
5. Check representative existing combos and Jitbit files, physical numpad shortcuts, and OS shortcut conflicts. Run the optional [recorder CPU/capture procedure](recorder-reliability.md) when validating recorder performance.
6. Fix any reproducible failures before release. After QA passes, review and commit the changes using a `fix:` Conventional Commit and use the normal PR workflow.
7. Let Release Please manage the release version. Inspect the draft release and attached installers before publication; do not use the bump scripts for the normal path.

An external dependency-advisory scan and live GitHub release/permission verification were not performed. Further bundle reduction and unused dependency/component cleanup remain maintenance follow-ups. At this handoff, implementation and documentation changes are still uncommitted.
