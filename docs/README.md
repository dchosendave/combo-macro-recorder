# Documentation index

This directory is the maintained reference for Hamin Macro Recorder. Prefer the narrowest document that owns a fact; avoid copying contract details into multiple files.

## For users and operators

- [User guide](user-guide.md) — create, record, edit, save, run, and recover combos.
- [Manual QA](manual-qa.md) — Windows checks that cannot be proven in headless tests.
- [Recorder reliability](recorder-reliability.md) — CPU probe and physical-input capture matrix.

## For maintainers and AI assistants

- [Architecture](architecture.md) — ownership, major flows, concurrency, and platform constraints.
- [Integration contracts](contracts.md) — Tauri commands/events, local storage, validation, and change coordination.
- [Combo file format](combo-file-format.md) — v4 schema and compatibility rules.
- [Testing](testing.md) — automated test conventions and CI expectations.
- [Development and release workflow](development-workflow.md) — branches, Conventional Commits, release PRs, and draft publication.
- [Security](security.md) — CSP, permissions, file access, global input, and elevation.
- [Architecture decisions](decisions/README.md) — why consequential designs exist.

## Root documents

- [`README.md`](../README.md) is the concise project landing page.
- [`AGENTS.md`](../AGENTS.md) contains operational instructions and invariants for code-changing assistants.
- [`CHANGELOG.md`](../CHANGELOG.md) records released user-visible changes.

## Maintenance rule

Update documentation in the same change as behavior:

| Change | Required documentation |
| --- | --- |
| User-visible behavior | User guide and changelog when released |
| Command, event, storage key, or wire shape | Contracts |
| Combo schema or migration | Combo format and an ADR if consequential |
| Ownership, lifecycle, or concurrency | Architecture |
| Security permission or trust boundary | Security |
| Behavior not automatable in CI | Manual QA |
| Important design tradeoff | Architecture decision record |

Tests and source types remain the executable specification. Documentation explains how those contracts fit together and why they exist.
