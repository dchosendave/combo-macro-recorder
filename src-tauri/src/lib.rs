mod commands;
mod runner;

use commands::files::{list_combo_files, read_file, read_jitbit_file, save_file};
use commands::hotkeys::{set_hotkeys, HotkeyState};
use commands::recorder::{start_recording, stop_recording};
use commands::window::set_hard_corners;
use runner::{init_timing, start_combo, stop_all, stop_all_inner, AppState};
use tauri::{Emitter, Manager, RunEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_timing();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        let state = app.try_state::<HotkeyState>();
                        if let Some(state) = state {
                            let mappings = state.mappings.lock();
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
            read_jitbit_file,
            set_hotkeys,
            start_recording,
            stop_recording,
            list_combo_files,
            set_hard_corners,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    // On exit, stop both channels so every held key is released before the
    // process dies — Windows does not auto-release SendInput-injected keys
    // when the injecting process exits. The loops poll `running` every ≤1ms
    // and release via their KeyReleaseGuard, so joining is fast.
    app.run(|app_handle, event| {
        if let RunEvent::ExitRequested { .. } = event {
            stop_all_inner(&app_handle.state::<AppState>());
        }
    });
}
