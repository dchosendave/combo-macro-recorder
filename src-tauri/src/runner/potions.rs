use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;

use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use serde::Deserialize;
use tauri::{AppHandle, Emitter};

use super::timing::{set_high_priority, sleep_precise};
use super::AppState;

#[derive(Deserialize, Clone)]
struct Keys {
    q: bool,
    w: bool,
    e: bool,
    r: bool,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PotionConfig {
    keys: Keys,
    delay_ms: u64,
    repeat_mode: String,
    repeat_count: u64,
}

fn enabled_potion_keys(keys: &Keys) -> Vec<char> {
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

fn release_all(enigo: &mut Enigo, sequence: &[char]) {
    for ch in sequence {
        let _ = enigo.key(Key::Unicode(*ch), Direction::Release);
    }
}

fn run_potions(config: PotionConfig, app: AppHandle, running: Arc<AtomicBool>) {
    set_high_priority();

    let sequence = enabled_potion_keys(&config.keys);
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
            sleep_precise(config.delay_ms, &running);
            if let Some(enigo) = enigo.as_mut() {
                let _ = enigo.key(Key::Unicode(*ch), Direction::Release);
            }
        }
        cycle += 1;
        if cycle % 10 == 0 {
            let _ = app.emit(
                "macro-activation",
                serde_json::json!({ "channel": "potions", "cycle": cycle, "keys": sequence }),
            );
        }

        if config.repeat_mode == "count" && cycle >= config.repeat_count.max(1) {
            let _ = app.emit(
                "macro-finished",
                serde_json::json!({ "channel": "potions", "cycle": cycle }),
            );
            running.store(false, Ordering::SeqCst);
            break;
        }
    }

    if let Some(enigo) = enigo.as_mut() {
        release_all(enigo, &sequence);
    }
}

/// Spawns the potions loop on a dedicated thread. The caller is responsible for
/// stopping the channel beforehand (see `start_combo`).
pub(crate) fn spawn_potions(config: PotionConfig, app: &AppHandle, state: &AppState) {
    let running = state.potions.running.clone();
    running.store(true, Ordering::SeqCst);

    let app = app.clone();
    let handle = thread::spawn(move || run_potions(config, app, running));

    *state.potions.handle.lock().unwrap() = Some(handle);
}
