# ADR 0001: Authoritative runner sessions

- Status: accepted

## Context

Optimistically toggling frontend state allows rapid commands, hotkey switches, backend errors, and delayed events to disagree about which channels are actually running.

## Decision

Rust owns runner truth. `start_combo`, `stop_all`, and `get_runner_status` return `RunnerStatus` with a backend-issued session ID and channel flags. Frontend commands are serialized and running/compact UI begins only after confirmation. Step-progress events carry the session ID and are ignored for other sessions.

## Consequences

Start/stop has an asynchronous confirmation boundary, but stale commands and visualization events cannot masquerade as the current run. Any new runner event that changes state should be session-aware or proven safe by thread joining/order.
