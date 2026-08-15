use std::collections::HashMap;
use std::str::FromStr;

use parking_lot::Mutex;

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

/// (to_unregister, to_register) — keys present only in `current` vs only in `new`.
fn diff_hotkeys(
    current: &HashMap<String, String>,
    new: &HashMap<String, String>,
) -> (Vec<String>, Vec<String>) {
    let to_unregister: Vec<String> = current
        .keys()
        .filter(|k| !new.contains_key(*k))
        .cloned()
        .collect();
    let to_register: Vec<String> = new
        .keys()
        .filter(|k| !current.contains_key(*k))
        .cloned()
        .collect();
    (to_unregister, to_register)
}

/// Unregisters removals, registers additions; on a register failure, re-registers
/// the removed keys (best-effort rollback) and returns Err, leaving caller state
/// unchanged.
fn apply_hotkey_diff(
    to_unregister: &[String],
    to_register: &[String],
    unregister: impl Fn(&str) -> Result<(), String>,
    register: impl Fn(&str) -> Result<(), String>,
) -> Result<(), String> {
    for key in to_unregister {
        let _ = unregister(key);
    }
    for key in to_register {
        if let Err(e) = register(key) {
            for rolled in to_unregister {
                let _ = register(rolled);
            }
            return Err(e);
        }
    }
    Ok(())
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

    let mut mappings = state.mappings.lock();

    let new_mappings = build_mappings(&hotkeys);
    let (to_unregister, to_register) = diff_hotkeys(&mappings, &new_mappings);

    // The closures capture only `gs`, never the `mappings` guard, so the
    // lock can stay held while the plugin is called (same pattern as before).
    apply_hotkey_diff(
        &to_unregister,
        &to_register,
        |key| {
            Shortcut::from_str(key)
                .map(|shortcut| gs.unregister(shortcut))
                .unwrap_or(Ok(()))
                .map_err(|e| e.to_string())
        },
        |key| gs.register(key).map_err(|e| e.to_string()),
    )?;

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

    #[test]
    fn diff_hotkeys_finds_additions_and_removals() {
        let empty = HashMap::new();
        let (u, r) = diff_hotkeys(&empty, &empty);
        assert!(u.is_empty() && r.is_empty(), "empty→empty is a no-op");

        // Pure addition.
        let mut new = HashMap::new();
        new.insert("F5".into(), "a".into());
        let (u, r) = diff_hotkeys(&empty, &new);
        assert!(u.is_empty());
        assert_eq!(r, vec!["F5"]);

        // Pure removal.
        let mut current = HashMap::new();
        current.insert("F5".into(), "a".into());
        let (u, r) = diff_hotkeys(&current, &empty);
        assert_eq!(u, vec!["F5"]);
        assert!(r.is_empty());

        // Both directions (sort — HashMap iteration order is unspecified).
        let mut current = HashMap::new();
        current.insert("F5".into(), "a".into());
        current.insert("F6".into(), "b".into());
        let mut new = HashMap::new();
        new.insert("F6".into(), "b".into());
        new.insert("F7".into(), "c".into());
        let (mut u, mut r) = diff_hotkeys(&current, &new);
        u.sort();
        r.sort();
        assert_eq!(u, vec!["F5"]);
        assert_eq!(r, vec!["F7"]);

        // Identical sets → no-op.
        let (u, r) = diff_hotkeys(&current, &new);
        assert_eq!(u, vec!["F5"]);
        assert_eq!(r, vec!["F7"]);
    }

    #[test]
    fn apply_hotkey_diff_unregisters_then_registers() {
        let log = std::sync::Mutex::new(Vec::new());
        let unregister = |key: &str| {
            log.lock().unwrap().push(format!("u:{key}"));
            Ok(())
        };
        let register = |key: &str| {
            log.lock().unwrap().push(format!("r:{key}"));
            Ok(())
        };

        apply_hotkey_diff(&["F5".into()], &["F6".into()], unregister, register).unwrap();
        assert_eq!(*log.lock().unwrap(), vec!["u:F5", "r:F6"]);
    }

    #[test]
    fn apply_hotkey_diff_rolls_back_unregisters_on_register_failure() {
        let log = std::sync::Mutex::new(Vec::new());
        let unregister = |key: &str| {
            log.lock().unwrap().push(format!("u:{key}"));
            Ok(())
        };
        let register = |key: &str| {
            log.lock().unwrap().push(format!("r:{key}"));
            if key == "F7" {
                Err("shortcut taken".into())
            } else {
                Ok(())
            }
        };

        let result = apply_hotkey_diff(
            &["F5".into()],
            &["F6".into(), "F7".into()],
            unregister,
            register,
        );
        assert_eq!(result, Err("shortcut taken".to_string()));
        // The failed register is followed by a best-effort re-register of every
        // removed key, so the caller's state is left unchanged.
        assert_eq!(*log.lock().unwrap(), vec!["u:F5", "r:F6", "r:F7", "r:F5"]);
    }

    #[test]
    fn apply_hotkey_diff_ignores_unregister_errors() {
        let log = std::sync::Mutex::new(Vec::new());
        let unregister = |_key: &str| Err("unregister failed".into());
        let register = |key: &str| {
            log.lock().unwrap().push(format!("r:{key}"));
            Ok(())
        };

        apply_hotkey_diff(&["F5".into()], &["F6".into()], unregister, register).unwrap();
        assert_eq!(
            *log.lock().unwrap(),
            vec!["r:F6"],
            "registration still proceeds"
        );
    }
}
