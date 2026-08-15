# Combo file format

Combo files are human-readable JSON. New saves use version 4. Import accepts versions 2, 3, and 4; unknown versions are rejected.

## Complete v4 example

```json
{
  "version": 4,
  "potions": {
    "enabled": true,
    "keys": { "q": true, "w": true, "e": false, "r": false },
    "customDelay": true,
    "delayMs": "150",
    "repeatMode": "count",
    "repeatCount": "5"
  },
  "skills": {
    "enabled": true,
    "holdRightClick": false,
    "labelStyle": "abbreviation",
    "repeatMode": "loop",
    "repeatCount": "1",
    "playbackSpeed": "1.5",
    "steps": [
      { "id": "local-uuid", "type": "keydown", "key": "1" },
      { "id": "local-uuid", "type": "delay", "ms": "120" },
      { "id": "local-uuid", "type": "keyup", "key": "1", "disabled": true }
    ]
  }
}
```

## Fields

Input-oriented numeric fields are stored as strings. `toRunnerInputs` converts and clamps them before invoking Rust.

### Potions

| Field | Meaning |
| --- | --- |
| `enabled` | Channel participates in Run when validation passes |
| `keys` | Q/W/E/R inclusion map |
| `customDelay` | Whether `delayMs` is user-controlled |
| `delayMs` | Hold duration string; minimum runtime value is 2 ms |
| `repeatMode` | `loop` or `count` |
| `repeatCount` | Count string, clamped to 1–999999 |

### Skills

| Field | Meaning |
| --- | --- |
| `enabled` | Channel participates in Run when validation passes |
| `holdRightClick` | Hold right mouse button for the channel lifetime |
| `labelStyle` | `abbreviation` or `icon` |
| `repeatMode` / `repeatCount` | Same semantics as potions |
| `playbackSpeed` | Optional 0.1–4× multiplier; absence means 1× |
| `steps` | Ordered skill-step array |

Step variants are `{type:"keydown",key}`, `{type:"keyup",key}`, or `{type:"delay",ms}`. `disabled:true` retains a step but removes it from validation, effective duration, and runner input. Absence or false means enabled.

Step IDs are frontend identities used for selection and React rendering. Current exports store them, and backend runner inputs remove them. A valid current editor-authored file therefore includes a unique string ID for every step; hand-written files should do the same. Import repairs missing, blank, and duplicate IDs with new UUIDs.

## Import behavior

`importComboFromString` normalizes parsed potion/skill objects into the current schema. Missing or incorrectly typed configuration fields receive defaults, numeric input fields are converted to strings, and unknown fields are discarded. A non-array `skills.steps` becomes an empty list. Malformed top-level JSON, unsupported versions, or structurally invalid individual steps throw an index-specific error.

Versions 2 and 3 had no disabled-step or playback-speed semantics. Missing values naturally import as enabled steps at 1×.

## Versioning rules

Bump the format only for a persisted semantic change that an older reader cannot safely interpret. When bumping:

1. Add the new type/default.
2. Update exporter version.
3. Preserve older import branches or add an explicit migration.
4. Test new round-trip behavior and every accepted older version.
5. Update this document, architecture, user guide, and changelog.
6. Verify recovery accepts a valid backup using any supported version.

Do not reuse a version number for incompatible semantics.
