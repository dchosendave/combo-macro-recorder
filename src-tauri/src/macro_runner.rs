use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use serde::Deserialize;
use tauri::{AppHandle, Emitter, State};

const SLEEP_SLICE_MS: u64 = 15;

#[derive(Deserialize, Clone)]
struct Keys {
    q: bool,
    w: bool,
    e: bool,
    r: bool,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MacroConfig {
    keys: Keys,
    delay_ms: u64,
    repeat_mode: String,
    repeat_count: u64,
}

#[derive(Default)]
pub struct AppState {
    running: Arc<AtomicBool>,
    handle: Mutex<Option<JoinHandle<()>>>,
}

fn enabled_keys(keys: &Keys) -> Vec<char> {
    let mut seq = Vec::new();
    if keys.q {
        seq.push('q');
    }
    if keys.w {
        seq.push('w');
    }
    if keys.e {
        seq.push('e');
    }
    if keys.r {
        seq.push('r');
    }
    seq
}

fn stop_worker(state: &AppState) {
    state.running.store(false, Ordering::SeqCst);
    if let Some(handle) = state.handle.lock().unwrap().take() {
        let _ = handle.join();
    }
}

fn sleep_interruptible(ms: u64, running: &AtomicBool) {
    let mut remaining = ms;
    while remaining > 0 && running.load(Ordering::SeqCst) {
        let slice = remaining.min(SLEEP_SLICE_MS);
        thread::sleep(Duration::from_millis(slice));
        remaining -= slice;
    }
}

fn release_all(enigo: &mut Enigo, sequence: &[char]) {
    for ch in sequence {
        let _ = enigo.key(Key::Unicode(*ch), Direction::Release);
    }
}


#[tauri::command]
pub fn start_macro(config: MacroConfig, app: AppHandle, state: State<'_, AppState>) {
    stop_worker(&state);

    let running = state.running.clone();
    running.store(true, Ordering::SeqCst);

    let handle = thread::spawn(move || {
        let sequence = enabled_keys(&config.keys);
        if sequence.is_empty() {
            running.store(false, Ordering::SeqCst);
            return;
        }

        let mut enigo = Enigo::new(&Settings::default()).ok();
        let mut cycle: u64 = 0;

        while running.load(Ordering::SeqCst) {
            for ch in &sequence {
                if !running.load(Ordering::SeqCst) {
                    break;
                }
                if let Some(enigo) = enigo.as_mut() {
                    let _ = enigo.key(Key::Unicode(*ch), Direction::Press);
                }
                sleep_interruptible(config.delay_ms, &running);
                if let Some(enigo) = enigo.as_mut() {
                    let _ = enigo.key(Key::Unicode(*ch), Direction::Release);
                }
            }
            cycle += 1;
            let _ = app.emit(
                "macro-activation",
                serde_json::json!({ "cycle": cycle, "keys": sequence }),
            );

            if config.repeat_mode == "count" && cycle >= config.repeat_count.max(1) {
                let _ = app.emit("macro-finished", cycle);
                running.store(false, Ordering::SeqCst);
                break;
            }
        }

        // Safety: ensure no key is left logically held down after stopping.
        if let Some(enigo) = enigo.as_mut() {
            release_all(enigo, &sequence);
        }
    });

    *state.handle.lock().unwrap() = Some(handle);
}

#[tauri::command]
pub fn stop_macro(state: State<'_, AppState>) {
    stop_worker(&state);
}
