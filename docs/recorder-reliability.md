# Recorder reliability checks

The recorder already limits polling to letters, digits, internally supported numpad and punctuation keys, F1–F20, and common navigation keys. It skips modifiers and unrelated virtual-key codes.

## Idle CPU probe

Run on Windows with no keys held:

```powershell
cargo test recorder_idle_cpu_probe -- --ignored --nocapture --test-threads=1
```

Record the reported percentage, Windows version, CPU model, power mode, and whether the app/test process was elevated. Repeat three times and use the median.

## Physical capture matrix

Automated input injection does not prove that Windows delivered a physical keyboard transition to `GetAsyncKeyState`. Test a real keyboard and compare the intended taps with the returned recording:

| Scenario | Repetitions | Pass condition |
| --- | ---: | --- |
| Normal taps (100 ms) | 100 | 100 down/up pairs, ordered |
| Fast taps (20–30 ms) | 100 | 100 down/up pairs, ordered |
| Very short taps (under 10 ms, if hardware permits) | 100 | Record observed capture rate |
| Alternating two keys | 100 pairs | No missing or reversed transitions |
| Two-key overlap | 100 pairs | Both downs precede their matching ups |
| Five-minute recording | 1 | No stuck keys; timestamps remain monotonic |

Run once normally and once elevated if the target game normally runs as administrator. A low-level keyboard hook should only replace polling if realistic 20–30 ms taps are missed or the CPU probe shows unacceptable sustained use.
