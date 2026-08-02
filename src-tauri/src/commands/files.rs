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

/// Reads a Jitbit `.mcr` file as text. Jitbit exports are usually UTF-8, but
/// older ones may be UTF-16 with a BOM — both are decoded and any BOM is
/// stripped. Other encodings fail with a clear error.
#[tauri::command]
pub fn read_jitbit_file(path: String) -> Result<String, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    decode_text(&bytes).ok_or_else(|| "File is not valid UTF-8 or UTF-16 text".to_string())
}

fn decode_text(bytes: &[u8]) -> Option<String> {
    if bytes.starts_with(&[0xFF, 0xFE]) {
        // UTF-16 LE with BOM
        let units: Vec<u16> = bytes[2..]
            .chunks_exact(2)
            .map(|c| u16::from_le_bytes([c[0], c[1]]))
            .collect();
        return String::from_utf16(&units).ok();
    }
    if bytes.starts_with(&[0xFE, 0xFF]) {
        // UTF-16 BE with BOM
        let units: Vec<u16> = bytes[2..]
            .chunks_exact(2)
            .map(|c| u16::from_be_bytes([c[0], c[1]]))
            .collect();
        return String::from_utf16(&units).ok();
    }
    let text = std::str::from_utf8(bytes).ok()?;
    Some(text.strip_prefix('\u{FEFF}').unwrap_or(text).to_string())
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
    fn read_jitbit_file_decodes_utf8_and_utf16_with_bom() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("combo.mcr").to_string_lossy().into_owned();

        std::fs::write(&path, "Keyboard : D1 : KeyDown\n").unwrap();
        assert_eq!(
            read_jitbit_file(path.clone()).unwrap(),
            "Keyboard : D1 : KeyDown\n"
        );

        // UTF-8 with BOM
        std::fs::write(&path, "\u{FEFF}Keyboard : D1 : KeyDown\n").unwrap();
        assert_eq!(
            read_jitbit_file(path.clone()).unwrap(),
            "Keyboard : D1 : KeyDown\n"
        );

        // UTF-16 LE with BOM
        let mut bytes = vec![0xFF, 0xFE];
        for unit in "DELAY : 50\n".encode_utf16() {
            bytes.extend_from_slice(&unit.to_le_bytes());
        }
        std::fs::write(&path, &bytes).unwrap();
        assert_eq!(read_jitbit_file(path).unwrap(), "DELAY : 50\n");
    }

    #[test]
    fn read_jitbit_file_rejects_invalid_encodings() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("binary.mcr").to_string_lossy().into_owned();
        // Invalid UTF-8 and no UTF-16 BOM.
        std::fs::write(&path, [0xFF, 0x00, 0xFE, 0x41]).unwrap();
        assert!(read_jitbit_file(path).is_err());
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

    #[test]
    fn read_jitbit_file_missing_file_errors() {
        let err = read_jitbit_file("Z:\\definitely\\not\\here.mcr".into()).unwrap_err();
        assert!(!err.is_empty());
    }

    #[test]
    fn read_jitbit_file_decodes_utf16_be_bom() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("combo.mcr").to_string_lossy().into_owned();

        let mut bytes = vec![0xFE, 0xFF];
        for unit in "DELAY : 50\n".encode_utf16() {
            bytes.extend_from_slice(&unit.to_be_bytes());
        }
        std::fs::write(&path, &bytes).unwrap();
        assert_eq!(read_jitbit_file(path).unwrap(), "DELAY : 50\n");
    }

    #[test]
    fn save_file_to_nonexistent_parent_errors() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir
            .path()
            .join("no-such-subdir")
            .join("combo.json")
            .to_string_lossy()
            .into_owned();
        assert!(save_file(path, "{}".into()).is_err());
    }

    #[test]
    fn read_and_save_on_directory_paths_error() {
        let dir = tempfile::tempdir().unwrap();
        let dir_path = dir.path().to_string_lossy().into_owned();

        assert!(read_file(dir_path.clone()).is_err(), "reading a directory must fail");
        assert!(save_file(dir_path, "{}".into()).is_err(), "writing over a directory must fail");
    }

    #[test]
    fn list_combo_files_on_a_file_path_errors() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("combo.json").to_string_lossy().into_owned();
        std::fs::write(&file_path, "{}").unwrap();

        assert!(list_combo_files(file_path).is_err());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn list_combo_files_skips_non_utf8_filenames() {
        use std::os::windows::ffi::OsStringExt;

        let dir = tempfile::tempdir().unwrap();
        // A lone UTF-16 surrogate makes the name non-UTF-8; it must be skipped
        // without panicking.
        let weird: std::ffi::OsString =
            std::ffi::OsString::from_wide(&[0x0063, 0x006F, 0x006D, 0x0062, 0x006F, 0xD800, 0x002E, 0x006A, 0x0073, 0x006F, 0x006E]); // "combo\u{D800}.json"
        std::fs::write(dir.path().join(weird), "{}").unwrap();
        std::fs::write(dir.path().join("good.json"), "{}").unwrap();

        let entries = list_combo_files(dir.path().to_string_lossy().into_owned()).unwrap();
        let names: Vec<_> = entries.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, vec!["good.json"]);
    }
}
