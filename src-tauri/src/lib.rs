mod macro_runner;

use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use macro_runner::{start_macro, stop_macro, AppState};
use tauri::Emitter;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        let _ = app.emit("macro-toggle", shortcut.to_string());
                    }
                })
                .build(),
        )
        .manage(AppState::default())
        .setup(|app| {
            use tauri_plugin_global_shortcut::GlobalShortcutExt;
            if let Err(e) = app.global_shortcut().register("F5") {
                eprintln!("[global-shortcut] failed to register F5: {e}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![test_press, start_macro, stop_macro])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
