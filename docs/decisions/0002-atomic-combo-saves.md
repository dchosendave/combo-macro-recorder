# ADR 0002: Atomic combo saves and explicit recovery

- Status: accepted

## Context

Writing directly to a combo file can leave truncated JSON after interruption. Silent automatic restoration could overwrite evidence or surprise the user.

## Decision

Save through a synced sibling temporary file and atomic replacement. Preserve the previous primary as `.bak`. When the primary cannot be parsed and the backup is valid, ask before restoring it.

## Consequences

Normal saves resist partial writes and retain one prior version. Recovery adds command/UI coordination but remains explicit and testable. Future retention policies must not weaken atomic replacement or silently delete the last good backup.
