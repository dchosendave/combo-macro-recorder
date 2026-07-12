use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;

use enigo::{Button, Direction, Enigo, Key, Keyboard, Mouse, Settings};
use serde::Deserialize;
use tauri::{AppHandle, Emitter, State};

use super::timing::{set_high_priority, sleep_precise};
use super::{stop_channel, AppState};

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
    hold_right_click: bool,
    steps: Vec<SkillStep>,
    repeat_mode: String,
    repeat_count: u64,
}

fn char_from_key(key: &str) -> Option<char> {
    key.chars().next()
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

fn run_skills(config: SkillConfig, app: AppHandle, running: Arc<AtomicBool>) {
    set_high_priority();

    let mut enigo = Enigo::new(&Settings::default()).ok();
    let mut cycle: u64 = 0;

    if config.hold_right_click {
        if let Some(enigo) = enigo.as_mut() {
            let _ = enigo.button(Button::Right, Direction::Press);
        }
    }

    while running.load(Ordering::SeqCst) {
        for step in &config.steps {
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
            let _ = app.emit(
                "macro-finished",
                serde_json::json!({ "channel": "skills", "cycle": cycle }),
            );
            running.store(false, Ordering::SeqCst);
            break;
        }
    }

    if let Some(enigo) = enigo.as_mut() {
        if config.hold_right_click {
            let _ = enigo.button(Button::Right, Direction::Release);
        }
        release_skill_keys(enigo, &config.steps);
    }
}

#[tauri::command]
pub fn start_skills(config: SkillConfig, app: AppHandle, state: State<'_, AppState>) {
    stop_channel(&state.skills);

    if config.steps.is_empty() {
        return;
    }

    let running = state.skills.running.clone();
    running.store(true, Ordering::SeqCst);

    let handle = thread::spawn(move || run_skills(config, app, running));

    *state.skills.handle.lock().unwrap() = Some(handle);
}
