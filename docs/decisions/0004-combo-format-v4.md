# ADR 0004: Combo file format v4

- Status: accepted

## Context

Per-step enable/disable must survive save/reopen, and playback speed must alter effective delays without destructively rewriting authored timing.

## Decision

New exports use v4. Steps may store `disabled:true`; skills may store `playbackSpeed`. Disabled steps remain editable but are removed before validation and runner conversion. Speed is clamped and applied only to converted delay copies. Import continues to accept v2/v3 with missing fields defaulting to enabled and 1×.

## Consequences

The frontend schema and importer carry compatibility responsibility. Rust runner types stay small because editor-only fields never cross the runner boundary. Future persisted semantics require an explicit version/migration review.
