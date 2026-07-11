mod macro_runner;

use std::collections::HashMap;
use std::sync::Mutex;

use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use macro_runner::{
    init_timing, read_file, save_file, start_all, start_potions, start_skills, stop_all,
    stop_potions, stop_skills, AppState,
};
use serde::Deserialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct HotkeyMapping {
    shortcut: String,
    profile_id: String,
}

struct HotkeyState {
    mappings: Mutex<HashMap<String, String>>,
}

fn press_key(ch: char) -> Result<(), String> {
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    enigo
        .key(Key::Unicode(ch), Direction::Click)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn test_press(key: String) -> Result<(), String> {
    let ch = key.chars().next().ok_or("empty key")?;
    press_key(ch)
}

#[tauri::command]
fn set_hotkeys(hotkeys: Vec<HotkeyMapping>, app: AppHandle, state: State<'_, HotkeyState>) -> Result<(), String> {
    let gs = app.global_shortcut();
    let _ = gs.unregister_all();

    let mut mappings = state.mappings.lock().unwrap();
    mappings.clear();

    for h in &hotkeys {
        gs.register(h.shortcut.as_str()).map_err(|e| e.to_string())?;
        mappings.insert(h.shortcut.clone(), h.profile_id.clone());
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_timing();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        let state = app.try_state::<HotkeyState>();
                        if let Some(state) = state {
                            let mappings = state.mappings.lock().unwrap();
                            let key = shortcut.to_string();
                            if let Some(profile_id) = mappings.get(&key) {
                                let _ = app.emit("macro-toggle", profile_id.clone());
                            }
                        }
                    }
                })
                .build(),
        )
        .manage(AppState::default())
        .manage(HotkeyState {
            mappings: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            test_press,
            start_potions,
            stop_potions,
            start_skills,
            stop_skills,
            start_all,
            stop_all,
            save_file,
            read_file,
            set_hotkeys,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
