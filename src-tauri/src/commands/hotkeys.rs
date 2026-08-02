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

/// Normalizes each shortcut string to the plugin's canonical form and maps it
/// to its hotkey id. Invalid shortcut strings pass through unchanged.
fn build_mappings(hotkeys: &[HotkeyMapping]) -> HashMap<String, String> {
    hotkeys
        .iter()
        .map(|h| {
            let key = Shortcut::from_str(&h.shortcut)
                .map(|s| s.to_string())
                .unwrap_or_else(|_| h.shortcut.clone());
            (key, h.hotkey_id.clone())
        })
        .collect()
}

/// Replaces the set of registered global shortcuts, diffing against the current
/// mappings: unregisters keys that are no longer present and registers new ones.
/// On a shortcut press, `lib.rs` emits a `macro-toggle` event carrying the hotkey id.
#[tauri::command]
pub fn set_hotkeys(
    hotkeys: Vec<HotkeyMapping>,
    app: AppHandle,
    state: State<'_, HotkeyState>,
) -> Result<(), String> {
    let gs = app.global_shortcut();

    let mut mappings = state.mappings.lock().unwrap();

    let new_mappings = build_mappings(&hotkeys);

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

#[cfg(test)]
mod tests {
    use super::*;

    fn mapping(shortcut: &str, id: &str) -> HotkeyMapping {
        HotkeyMapping {
            shortcut: shortcut.into(),
            hotkey_id: id.into(),
        }
    }

    #[test]
    fn valid_shortcuts_normalize_and_map_to_ids() {
        let mappings = build_mappings(&[mapping("F5", "a"), mapping("Control+F5", "b")]);
        assert_eq!(mappings.len(), 2);
        assert_eq!(mappings.get("F5").map(String::as_str), Some("a"));
        // The plugin canonicalizes modifiers to lowercase.
        assert_eq!(mappings.get("control+F5").map(String::as_str), Some("b"));
    }

    #[test]
    fn invalid_shortcuts_pass_through_unchanged() {
        let mappings = build_mappings(&[mapping("NotAKey", "a")]);
        assert_eq!(mappings.get("NotAKey").map(String::as_str), Some("a"));
    }

    #[test]
    fn duplicate_shortcuts_last_wins() {
        let mappings = build_mappings(&[mapping("F5", "first"), mapping("F5", "second")]);
        assert_eq!(mappings.len(), 1);
        assert_eq!(mappings.get("F5").map(String::as_str), Some("second"));
    }

    #[test]
    fn empty_list_builds_empty_mappings() {
        assert!(build_mappings(&[]).is_empty());
    }
}
