mod commands;
mod runner;

use commands::files::{read_file, save_file};
use commands::hotkeys::{set_hotkeys, HotkeyState};
use commands::recorder::{start_recording, stop_recording};
use runner::{init_timing, start_combo, stop_all, AppState};
use tauri::{Emitter, Manager};

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
                            if let Some(hotkey_id) = mappings.get(&key) {
                                let _ = app.emit("macro-toggle", hotkey_id.clone());
                            }
                        }
                    }
                })
                .build(),
        )
        .manage(AppState::default())
        .manage(HotkeyState::default())
        .invoke_handler(tauri::generate_handler![
            start_combo,
            stop_all,
            save_file,
            read_file,
            set_hotkeys,
            start_recording,
            stop_recording,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
