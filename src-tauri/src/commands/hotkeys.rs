use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Mutex;

use serde::Deserialize;
use tauri::{AppHandle, State};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

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
        let key = Shortcut::from_str(&h.shortcut)
            .map(|s| s.to_string())
            .unwrap_or_else(|_| h.shortcut.clone());
        mappings.insert(key, h.hotkey_id.clone());
    }
    Ok(())
}
