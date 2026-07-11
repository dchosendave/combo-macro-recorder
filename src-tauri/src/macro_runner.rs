use std::hint;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use serde::Deserialize;
use tauri::{AppHandle, Emitter, State};

extern "system" {
    fn timeBeginPeriod(uPeriod: u32) -> u32;
    fn GetCurrentThread() -> isize;
    fn SetThreadPriority(hThread: isize, nPriority: i32) -> i32;
}

pub fn init_timing() {
    unsafe {
        timeBeginPeriod(1);
    }
}

fn set_high_priority() {
    unsafe {
        let thread = GetCurrentThread();
        SetThreadPriority(thread, 2);
    }
}

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

#[derive(Deserialize, Clone)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum SkillStep {
    #[serde(rename = "keydown")]
    KeyDown { key: String },
    #[serde(rename = "keyup")]
    KeyUp { key: String },
    #[serde(rename = "delay")]
    Delay { ms: u64 },
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SkillConfig {
    steps: Vec<SkillStep>,
    repeat_mode: String,
    repeat_count: u64,
}

#[derive(Default)]
pub(crate) struct ChannelState {
    running: Arc<AtomicBool>,
    handle: Mutex<Option<JoinHandle<()>>>,
}

#[derive(Default)]
pub struct AppState {
    pub potions: ChannelState,
    pub skills: ChannelState,
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

fn stop_channel(state: &ChannelState) {
    state.running.store(false, Ordering::SeqCst);
    if let Some(handle) = state.handle.lock().unwrap().take() {
        let _ = handle.join();
    }
}

fn sleep_precise(ms: u64, running: &AtomicBool) {
    if ms == 0 {
        return;
    }

    let target = Instant::now() + Duration::from_millis(ms);

    loop {
        if !running.load(Ordering::SeqCst) {
            return;
        }

        let now = Instant::now();
        if now >= target {
            break;
        }

        let remaining = target - now;
        if remaining > Duration::from_millis(2) {
            thread::sleep(Duration::from_millis(1));
        } else if remaining > Duration::from_micros(500) {
            thread::yield_now();
        } else {
            hint::spin_loop();
        }
    }
}

fn release_all(enigo: &mut Enigo, sequence: &[char]) {
    for ch in sequence {
        let _ = enigo.key(Key::Unicode(*ch), Direction::Release);
    }
}

fn release_skill_keys(enigo: &mut Enigo, steps: &[SkillStep]) {
    for step in steps {
        if let SkillStep::KeyDown { key } | SkillStep::KeyUp { key } = step {
            if let Some(ch) = char_from_key(key) {
                let _ = enigo.key(Key::Unicode(ch), Direction::Release);
            }
        }
    }
}

fn char_from_key(key: &str) -> Option<char> {
    key.chars().next()
}

#[tauri::command]
pub fn start_potions(config: PotionConfig, app: AppHandle, state: State<'_, AppState>) {
    stop_channel(&state.potions);

    let running = state.potions.running.clone();
    running.store(true, Ordering::SeqCst);

    let handle = thread::spawn(move || {
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
                let _ = app.emit("macro-finished", serde_json::json!({ "channel": "potions", "cycle": cycle }));
                running.store(false, Ordering::SeqCst);
                break;
            }
        }

        if let Some(enigo) = enigo.as_mut() {
            release_all(enigo, &sequence);
        }
    });

    *state.potions.handle.lock().unwrap() = Some(handle);
}

#[tauri::command]
pub fn stop_potions(state: State<'_, AppState>) {
    stop_channel(&state.potions);
}

#[tauri::command]
pub fn start_skills(config: SkillConfig, app: AppHandle, state: State<'_, AppState>) {
    stop_channel(&state.skills);

    if config.steps.is_empty() {
        return;
    }

    let running = state.skills.running.clone();
    running.store(true, Ordering::SeqCst);

    let steps = config.steps.clone();

    let handle = thread::spawn(move || {
        set_high_priority();
        let mut enigo = Enigo::new(&Settings::default()).ok();
        let mut cycle: u64 = 0;

        while running.load(Ordering::SeqCst) {
            for step in &steps {
                if !running.load(Ordering::SeqCst) {
                    break;
                }
                match step {
                    SkillStep::Delay { ms } => {
                        sleep_precise(*ms, &running);
                    }
                    SkillStep::KeyDown { key } => {
                        if let Some(ch) = char_from_key(key) {
                            if let Some(enigo) = enigo.as_mut() {
                                let _ = enigo.key(Key::Unicode(ch), Direction::Press);
                            }
                        }
                    }
                    SkillStep::KeyUp { key } => {
                        if let Some(ch) = char_from_key(key) {
                            if let Some(enigo) = enigo.as_mut() {
                                let _ = enigo.key(Key::Unicode(ch), Direction::Release);
                            }
                        }
                    }
                }
            }
            cycle += 1;
            let _ = app.emit(
                "macro-activation",
                serde_json::json!({ "channel": "skills", "cycle": cycle }),
            );

            if config.repeat_mode == "count" && cycle >= config.repeat_count.max(1) {
                let _ = app.emit("macro-finished", serde_json::json!({ "channel": "skills", "cycle": cycle }));
                running.store(false, Ordering::SeqCst);
                break;
            }
        }

        if let Some(enigo) = enigo.as_mut() {
            release_skill_keys(enigo, &steps);
        }
    });

    *state.skills.handle.lock().unwrap() = Some(handle);
}

#[tauri::command]
pub fn stop_skills(state: State<'_, AppState>) {
    stop_channel(&state.skills);
}

#[tauri::command]
pub fn start_all(
    potions_config: PotionConfig,
    skills_config: SkillConfig,
    app: AppHandle,
    state: State<'_, AppState>,
) {
    stop_channel(&state.potions);
    stop_channel(&state.skills);

    start_potions_inner(&potions_config, &app, &state);
    start_skills_inner(&skills_config, &app, &state);
}

fn start_potions_inner(config: &PotionConfig, app: &AppHandle, state: &AppState) {
    let running = state.potions.running.clone();
    let sequence = enabled_potion_keys(&config.keys);
    if sequence.is_empty() {
        return;
    }

    running.store(true, Ordering::SeqCst);
    let config = config.clone();
    let app = app.clone();

    let handle = thread::spawn(move || {
        set_high_priority();
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
                let _ = app.emit("macro-finished", serde_json::json!({ "channel": "potions", "cycle": cycle }));
                running.store(false, Ordering::SeqCst);
                break;
            }
        }

        if let Some(enigo) = enigo.as_mut() {
            release_all(enigo, &sequence);
        }
    });

    *state.potions.handle.lock().unwrap() = Some(handle);
}

fn start_skills_inner(config: &SkillConfig, app: &AppHandle, state: &AppState) {
    if config.steps.is_empty() {
        return;
    }

    let running = state.skills.running.clone();
    running.store(true, Ordering::SeqCst);
    let steps = config.steps.clone();
    let config = config.clone();
    let app = app.clone();

    let handle = thread::spawn(move || {
        set_high_priority();
        let mut enigo = Enigo::new(&Settings::default()).ok();
        let mut cycle: u64 = 0;

        while running.load(Ordering::SeqCst) {
            for step in &steps {
                if !running.load(Ordering::SeqCst) {
                    break;
                }
                match step {
                    SkillStep::Delay { ms } => {
                        sleep_precise(*ms, &running);
                    }
                    SkillStep::KeyDown { key } => {
                        if let Some(ch) = char_from_key(key) {
                            if let Some(enigo) = enigo.as_mut() {
                                let _ = enigo.key(Key::Unicode(ch), Direction::Press);
                            }
                        }
                    }
                    SkillStep::KeyUp { key } => {
                        if let Some(ch) = char_from_key(key) {
                            if let Some(enigo) = enigo.as_mut() {
                                let _ = enigo.key(Key::Unicode(ch), Direction::Release);
                            }
                        }
                    }
                }
            }
            cycle += 1;
            let _ = app.emit(
                "macro-activation",
                serde_json::json!({ "channel": "skills", "cycle": cycle }),
            );

            if config.repeat_mode == "count" && cycle >= config.repeat_count.max(1) {
                let _ = app.emit("macro-finished", serde_json::json!({ "channel": "skills", "cycle": cycle }));
                running.store(false, Ordering::SeqCst);
                break;
            }
        }

        if let Some(enigo) = enigo.as_mut() {
            release_skill_keys(enigo, &steps);
        }
    });

    *state.skills.handle.lock().unwrap() = Some(handle);
}

#[tauri::command]
pub fn stop_all(state: State<'_, AppState>) {
    stop_channel(&state.potions);
    stop_channel(&state.skills);
}

#[tauri::command]
pub fn save_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, &content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}
