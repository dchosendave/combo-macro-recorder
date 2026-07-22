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

    let mut mappings = state.mappings.lock().unwrap();

    let new_mappings: HashMap<String, String> = hotkeys
        .iter()
        .map(|h| {
            let key = Shortcut::from_str(&h.shortcut)
                .map(|s| s.to_string())
                .unwrap_or_else(|_| h.shortcut.clone());
            (key, h.hotkey_id.clone())
        })
        .collect();

    for (key, _) in mappings.iter() {
        if !new_mappings.contains_key(key) {
            if let Ok(shortcut) = Shortcut::from_str(key) {
                let _ = gs.unregister(shortcut);
            }
        }
    }

    for h in &hotkeys {
        let key = Shortcut::from_str(&h.shortcut)
            .map(|s| s.to_string())
            .unwrap_or_else(|_| h.shortcut.clone());
        if !mappings.contains_key(&key) {
            gs.register(h.shortcut.as_str()).map_err(|e| e.to_string())?;
        }
    }

    *mappings = new_mappings;
    Ok(())
}
