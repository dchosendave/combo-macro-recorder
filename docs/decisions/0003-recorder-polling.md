# ADR 0003: Polling-based Windows recorder

- Status: accepted, measurement-gated review

## Context

Low-level keyboard hooks can capture transitions directly but add native callback/thread lifecycle, cleanup, elevation, and security complexity. Polling `GetAsyncKeyState` is simpler but may consume CPU or miss taps shorter than its effective interval.

## Decision

Keep a high-priority polling thread with a 1 ms requested sleep and a filtered supported-key vocabulary. Maintain a repeatable CPU probe and physical-key capture matrix. Replace it with a hook only when measurements show unacceptable realistic missed-event rate or sustained CPU use.

## Consequences

The measured local idle cost was approximately 3.64% of one core (0.23% of 16 logical cores), so performance alone does not justify hooks. Physical capture remains a Windows manual-QA responsibility. Do not claim a 1 ms sleep guarantees 1 ms event precision.
