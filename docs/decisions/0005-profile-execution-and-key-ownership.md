# 0005 - Profile execution and channel key ownership

Date: 2026-09-27. Status: accepted.

## Context

Executing a saved profile previously replaced editor contents without replacing its save path. Independent channel release guards could also release a key held by the other channel.

## Decision

Saved profiles supply runner inputs directly and do not mutate the editor document or dirty baseline. Native startup rejects Q/W/E/R overlap between active potion and skill channels before stopping an existing run. No persisted schema change is required.

## Consequences

Users can run B while safely editing/saving A. Profile playback does not highlight unrelated editor steps. Combos that previously shared channel keys must remove overlap. Shared key ownership is deferred until overlapping channels become an explicit requirement.
