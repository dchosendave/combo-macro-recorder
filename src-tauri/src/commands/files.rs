use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComboFileEntry {
    pub name: String,
    pub path: String,
}

/// Writes raw text to a path (used for saving combo JSON files).
#[tauri::command]
pub fn save_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, &content).map_err(|e| e.to_string())
}

/// Reads a file's raw text (used for loading combo JSON files).
#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// Lists `.json` files in a directory, case-insensitive sorted. Used by the
/// Hotkeys tab's combo-file picker.
#[tauri::command]
pub fn list_combo_files(path: String) -> Result<Vec<ComboFileEntry>, String> {
    let dir = std::path::Path::new(&path);
    if !dir.is_dir() {
        return Err("Directory does not exist".into());
    }

    let mut entries = Vec::new();
    for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let entry_path = entry.path();
        if entry_path.extension().map(|e| e == "json").unwrap_or(false) {
            if let Some(name) = entry_path.file_name().and_then(|n| n.to_str()) {
                entries.push(ComboFileEntry {
                    name: name.to_string(),
                    path: entry_path.to_string_lossy().into_owned(),
                });
            }
        }
    }

    entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(entries)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;

    #[test]
    fn save_then_read_round_trips() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("combo.json").to_string_lossy().into_owned();

        save_file(path.clone(), r#"{"version":3}"#.into()).unwrap();
        assert_eq!(read_file(path).unwrap(), r#"{"version":3}"#);
    }

    #[test]
    fn read_missing_file_errors() {
        let err = read_file("Z:\\definitely\\not\\here.json".into()).unwrap_err();
        assert!(!err.is_empty());
    }

    #[test]
    fn list_returns_only_json_sorted_case_insensitively() {
        let dir = tempfile::tempdir().unwrap();
        for name in ["comboB.json", "comboA.json", "notes.txt", "sub/comboC.json"] {
            let path = dir.path().join(name);
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).unwrap();
            }
            fs::write(path, "{}").unwrap();
        }

        let entries = list_combo_files(dir.path().to_string_lossy().into_owned()).unwrap();
        let names: Vec<_> = entries.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, vec!["comboA.json", "comboB.json"]);
    }

    #[test]
    fn list_missing_directory_errors() {
        assert!(list_combo_files("Z:\\not\\a\\dir".into()).is_err());
    }

    #[test]
    fn list_empty_directory_returns_nothing() {
        let dir = tempfile::tempdir().unwrap();
        let entries = list_combo_files(dir.path().to_string_lossy().into_owned()).unwrap();
        assert!(entries.is_empty());
    }
}
