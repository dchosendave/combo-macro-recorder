use std::collections::HashMap;
use std::sync::Mutex;

use serde::Deserialize;
use tauri::{AppHandle, State};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HotkeyMapping {
    shortcut: String,
    hotkey_id: String,
}

#[derive(Default)]
pub struct HotkeyState {
    pub mappings: Mutex<HashMap<String, String>>,
}

#[tauri::command]
pub fn set_hotkeys(
    hotkeys: Vec<HotkeyMapping>,
    app: AppHandle,
    state: State<'_, HotkeyState>,
) -> Result<(), String> {
    let gs = app.global_shortcut();
    let _ = gs.unregister_all();

    let mut mappings = state.mappings.lock().unwrap();
    mappings.clear();

    for h in &hotkeys {
        gs.register(h.shortcut.as_str()).map_err(|e| e.to_string())?;
        mappings.insert(h.shortcut.clone(), h.hotkey_id.clone());
    }
    Ok(())
}
