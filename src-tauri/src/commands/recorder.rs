use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use serde::Serialize;

// ── Win32 types ────────────────────────────────────────

type SHORT = i16;

extern "system" {
    fn GetAsyncKeyState(v_key: i32) -> SHORT;
    fn GetCurrentThread() -> isize;
    fn SetThreadPriority(h_thread: isize, n_priority: i32) -> i32;
}

// ── Recording state ────────────────────────────────────

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordedEvent {
    pub timestamp_ms: u64,
    pub key: String,
    pub action: String,
}

pub struct RecordingState {
    pub active: bool,
    pub events: Vec<RecordedEvent>,
    pub start_time: std::time::Instant,
    pub thread_handle: Option<JoinHandle<()>>,
    pub stop_flag: Option<Arc<AtomicBool>>,
}

static RECORDING: LazyLock<Mutex<RecordingState>> = LazyLock::new(|| {
    Mutex::new(RecordingState {
        active: false,
        events: Vec::new(),
        start_time: std::time::Instant::now(),
        thread_handle: None,
        stop_flag: None,
    })
});

// ── VK code to readable key name ───────────────────────

fn vk_to_readable(vk: i32) -> String {
    match vk as u32 {
        0x41..=0x5A => char::from_u32(vk as u32).unwrap_or('?').to_string(),
        0x30..=0x39 => char::from_u32(vk as u32).unwrap_or('?').to_string(),
        0x60..=0x69 => format!("Num{}", vk - 0x60),
        0x70..=0x79 => format!("F{}", vk - 0x70 + 1),
        0x7A..=0x83 => format!("F{}", vk - 0x7A + 11),
        0x08 => "Backspace".into(),
        0x09 => "Tab".into(),
        0x0D => "Enter".into(),
        0x1B => "Escape".into(),
        0x20 => "Space".into(),
        0x2E => "Delete".into(),
        0x2D => "Insert".into(),
        0x24 => "Home".into(),
        0x23 => "End".into(),
        0x21 => "PageUp".into(),
        0x22 => "PageDown".into(),
        0x25 => "Left".into(),
        0x27 => "Right".into(),
        0x26 => "Up".into(),
        0x28 => "Down".into(),
        0xBA => ";".into(),
        0xBB => "=".into(),
        0xBC => ",".into(),
        0xBD => "-".into(),
        0xBE => ".".into(),
        0xBF => "/".into(),
        0xC0 => "`".into(),
        0xDB => "[".into(),
        0xDC => "\\".into(),
        0xDD => "]".into(),
        0xDE => "'".into(),
        _ => format!("VK_{}", vk),
    }
}

// ── Polling thread ─────────────────────────────────────

// Keys we care about: letters, digits, F-keys, and common special keys.
// Modifier keys (Ctrl=0x11, Alt=0x12, Shift=0x10) are skipped.
fn should_track(vk: i32) -> bool {
    matches!(vk as u32,
        0x08..=0x09 | 0x0D | 0x1B | 0x20..=0x28 |
        0x2D..=0x2E | 0x30..=0x39 | 0x41..=0x5A |
        0x60..=0x69 | 0x70..=0x83 |
        0xBA..=0xBF | 0xC0 | 0xDB..=0xDE
    )
}

fn poll_thread(stop: Arc<AtomicBool>) {
    set_high_priority();

    let mut prev = [false; 256];

    while !stop.load(Ordering::SeqCst) {
        let mut batch: Vec<RecordedEvent> = Vec::new();

        for vk in 1..255 {
            if !should_track(vk) {
                continue;
            }
            unsafe {
                let keystate = GetAsyncKeyState(vk);
                let pressed = keystate < 0;
                if pressed != prev[vk as usize] {
                    prev[vk as usize] = pressed;
                    let action = if pressed { "keydown" } else { "keyup" };

                    // Record with current timestamp (not elapsed — we fix it after stop)
                    // Use a counter-based approach for more precise relative timing
                    batch.push(RecordedEvent {
                        timestamp_ms: 0, // will be recalculated
                        key: vk_to_readable(vk),
                        action: action.to_string(),
                    });
                }
            }
        }

        if !batch.is_empty() {
            if let Ok(mut state) = RECORDING.lock() {
                let elapsed = state.start_time.elapsed().as_millis() as u64;
                for event in &mut batch {
                    event.timestamp_ms = elapsed;
                }
                state.events.extend(batch);
            }
        }

        // Sleep 1ms between polls — catches keys with ~1ms precision
        thread::sleep(Duration::from_millis(1));
    }
}

fn set_high_priority() {
    unsafe {
        let thread_handle = GetCurrentThread();
        SetThreadPriority(thread_handle, 2);
    }
}

// ── Tauri commands ─────────────────────────────────────

/// Starts the recording poll thread. Records keystrokes system-wide regardless
/// of window focus; errors if already recording.
#[tauri::command]
pub fn start_recording() -> Result<(), String> {
    let mut state = RECORDING.lock().map_err(|e| e.to_string())?;
    if state.active {
        return Err("Already recording".into());
    }

    state.active = true;
    state.events.clear();
    state.start_time = std::time::Instant::now();

    let stop = Arc::new(AtomicBool::new(false));
    let stop_clone = stop.clone();

    let handle = thread::spawn(move || {
        poll_thread(stop_clone);
    });

    state.thread_handle = Some(handle);
    state.stop_flag = Some(stop);

    Ok(())
}

/// Stops the recording poll thread, joins it, and returns the recorded events
/// (keydown/keyup with millisecond timestamps relative to recording start).
#[tauri::command]
pub fn stop_recording() -> Result<Vec<RecordedEvent>, String> {
    let mut state = RECORDING.lock().map_err(|e| e.to_string())?;

    if !state.active {
        return Err("Not recording".into());
    }

    // Signal the poll thread to stop
    if let Some(ref stop) = state.stop_flag {
        stop.store(true, Ordering::SeqCst);
    }

    // Wait for the thread to finish
    if let Some(handle) = state.thread_handle.take() {
        drop(state);
        let _ = handle.join();
        state = RECORDING.lock().map_err(|e| e.to_string())?;
    }

    state.active = false;

    // Recalculate timestamps relative to start_time
    // Since events are timestamped with elapsed ms at batch time,
    // and we poll every 1ms, the timestamps are already close to real.
    // No recalculation needed — the timestamp is already elapsed ms.

    let events = state.events.drain(..).collect();
    Ok(events)
}

#[cfg(test)]
#[cfg(target_os = "windows")]
mod tests {
    use super::*;

    #[test]
    fn vk_to_readable_covers_known_keys() {
        assert_eq!(vk_to_readable(0x41), "A");
        assert_eq!(vk_to_readable(0x30), "0");
        assert_eq!(vk_to_readable(0x60), "Num0");
        assert_eq!(vk_to_readable(0x69), "Num9");
        assert_eq!(vk_to_readable(0x70), "F1");
        assert_eq!(vk_to_readable(0x7A), "F11");
        assert_eq!(vk_to_readable(0x83), "F20");
        assert_eq!(vk_to_readable(0x08), "Backspace");
        assert_eq!(vk_to_readable(0x0D), "Enter");
        assert_eq!(vk_to_readable(0x20), "Space");
        assert_eq!(vk_to_readable(0xBA), ";");
        assert_eq!(vk_to_readable(0xDB), "[");
        assert_eq!(vk_to_readable(0xDE), "'");
    }

    #[test]
    fn vk_to_readable_falls_back_to_vk_prefix() {
        assert_eq!(vk_to_readable(0x5B), "VK_91");
        assert_eq!(vk_to_readable(0x00), "VK_0");
    }

    #[test]
    fn should_track_skips_modifiers_and_unknown_codes() {
        // Letters, digits, F-keys, and common special keys are tracked.
        assert!(should_track(0x41)); // A
        assert!(should_track(0x30)); // 0
        assert!(should_track(0x70)); // F1
        assert!(should_track(0x20)); // Space
        assert!(should_track(0xBA)); // ;
        // Modifiers are intentionally skipped.
        assert!(!should_track(0x10)); // Shift
        assert!(!should_track(0x11)); // Ctrl
        assert!(!should_track(0x12)); // Alt
        // Out-of-range / uncommon codes are skipped.
        assert!(!should_track(0x00));
        assert!(!should_track(0x1C));
    }

    #[test]
    fn recording_lifecycle_starts_once_and_stops_with_events() {
        // The RECORDING static is per test binary; no other test touches it.
        start_recording().expect("recording should start");
        assert!(start_recording().is_err(), "double-start must error");

        std::thread::sleep(std::time::Duration::from_millis(10));
        let events = stop_recording().expect("recording should stop");

        for e in &events {
            assert!(!e.key.is_empty(), "recorded events must carry a readable key");
            assert!(
                e.action == "keydown" || e.action == "keyup",
                "recorded action must be keydown/keyup"
            );
        }
        // Timestamps must be monotonic non-decreasing.
        assert!(
            events.windows(2).all(|w| w[0].timestamp_ms <= w[1].timestamp_ms),
            "recorded timestamps must be monotonic"
        );
    }
}
