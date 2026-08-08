use crate::runner::{dedupe_for_picker, running_processes_with_details, ProcessInfo};

/// Snapshot of running processes for the Settings → Auto-stop picker: deduped
/// by executable name (case-insensitive), sorted, with the first visible window
/// title and a version-resource friendly name per process. Empty on non-Windows.
#[tauri::command]
pub fn list_processes() -> Vec<ProcessInfo> {
    dedupe_for_picker(running_processes_with_details())
}
