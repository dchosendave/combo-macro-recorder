use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComboFileEntry {
    pub name: String,
    pub path: String,
}

#[tauri::command]
pub fn save_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, &content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

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
