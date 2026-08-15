use std::ffi::OsString;
use std::path::PathBuf;

#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStringExt;

use serde::Serialize;

/// A running process: PID, executable name, and — when the Settings picker
/// asks — the first visible window title and a friendly name from the exe's
/// version resource.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub title: Option<String>,
    pub friendly: Option<String>,
}

/// Snapshot of running processes (names only). Cheap enough for the focus
/// monitor's 4 Hz polling — no window or version-resource queries.
pub(crate) fn running_processes() -> Vec<ProcessInfo> {
    #[cfg(target_os = "windows")]
    {
        enumerate_processes_windows()
    }
    #[cfg(not(target_os = "windows"))]
    {
        Vec::new()
    }
}

/// Picker-grade snapshot: adds the first visible window title per PID and a
/// friendly name from each exe's version resource (`FileDescription`, falling
/// back to `ProductName`). Reads exe metadata from disk, so it is only for the
/// Settings picker — never the monitor loop.
pub(crate) fn running_processes_with_details() -> Vec<ProcessInfo> {
    let mut processes = running_processes();
    #[cfg(target_os = "windows")]
    {
        attach_window_titles(&mut processes);
        for p in &mut processes {
            if let Some(path) = exe_path(p.pid) {
                p.friendly = friendly_name_from_path(&path);
            }
        }
    }
    processes
}

/// Collapses duplicate executable names (case-insensitive) for the picker —
/// the focus monitor matches by name, so multiple instances are one row. Keeps
/// the first entry per name but adopts a window title / friendly name from a
/// later instance if the first lacked one; sorts case-insensitively by name.
pub(crate) fn dedupe_for_picker(processes: Vec<ProcessInfo>) -> Vec<ProcessInfo> {
    let mut by_name: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    let mut out: Vec<ProcessInfo> = Vec::with_capacity(processes.len());
    for p in processes {
        let key = p.name.to_lowercase();
        if let Some(&idx) = by_name.get(&key) {
            let existing = &mut out[idx];
            if existing.title.is_none() && p.title.is_some() {
                existing.title = p.title;
            }
            if existing.friendly.is_none() && p.friendly.is_some() {
                existing.friendly = p.friendly;
            }
        } else {
            by_name.insert(key, out.len());
            out.push(p);
        }
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    out
}

/// Case-insensitive exe-name comparison; a trailing `.exe` on either side is
/// ignored so `main.exe` and `MAIN` both match `main.exe`.
pub(crate) fn process_name_matches(configured: &str, name: &str) -> bool {
    let configured = configured.trim().to_lowercase();
    let configured = configured.strip_suffix(".exe").unwrap_or(&configured);
    let name = name.to_lowercase();
    let name = name.strip_suffix(".exe").unwrap_or(&name);
    name == configured
}

/// Reads a null-terminated `WCHAR` array (e.g. `PROCESSENTRY32W::szExeFile`)
/// into a `String`, dropping the trailing NUL.
pub(crate) fn wchar_array_to_string(chars: &[u16]) -> String {
    let len = chars.iter().position(|&c| c == 0).unwrap_or(chars.len());
    String::from_utf16_lossy(&chars[..len])
}

#[cfg(target_os = "windows")]
fn enumerate_processes_windows() -> Vec<ProcessInfo> {
    use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };

    let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
    if snapshot == INVALID_HANDLE_VALUE {
        return Vec::new();
    }

    let mut processes: Vec<ProcessInfo> = Vec::new();
    let mut entry: PROCESSENTRY32W = unsafe { std::mem::zeroed() };
    entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
    let mut ok = unsafe { Process32FirstW(snapshot, &mut entry) } != 0;
    while ok {
        let name = wchar_array_to_string(&entry.szExeFile);
        if !name.is_empty() {
            processes.push(ProcessInfo {
                pid: entry.th32ProcessID,
                name,
                title: None,
                friendly: None,
            });
        }
        ok = unsafe { Process32NextW(snapshot, &mut entry) } != 0;
    }
    unsafe { CloseHandle(snapshot) };
    processes
}

/// Fills in the first visible, non-empty window title per PID.
#[cfg(target_os = "windows")]
fn attach_window_titles(processes: &mut [ProcessInfo]) {
    use std::collections::HashMap;

    use windows_sys::Win32::UI::WindowsAndMessaging::EnumWindows;

    let mut titles: HashMap<u32, String> = HashMap::new();
    unsafe {
        EnumWindows(
            Some(collect_window_titles),
            &mut titles as *mut HashMap<u32, String> as isize,
        );
    }
    for p in processes.iter_mut() {
        if let Some(title) = titles.get(&p.pid) {
            p.title = Some(title.clone());
        }
    }
}

/// `EnumWindows` callback: records the first visible window title per PID.
#[cfg(target_os = "windows")]
unsafe extern "system" fn collect_window_titles(
    hwnd: windows_sys::Win32::Foundation::HWND,
    lparam: isize,
) -> windows_sys::core::BOOL {
    use std::collections::HashMap;

    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetWindowTextW, GetWindowThreadProcessId, IsWindowVisible,
    };

    if unsafe { IsWindowVisible(hwnd) } == 0 {
        return 1; // keep enumerating
    }
    let mut pid: u32 = 0;
    unsafe { GetWindowThreadProcessId(hwnd, &mut pid) };
    if pid == 0 {
        return 1;
    }

    let mut buf = [0u16; 256];
    let len = unsafe { GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32) };
    let title = if len > 0 {
        wchar_array_to_string(&buf[..len as usize])
    } else {
        String::new()
    };
    if title.trim().is_empty() {
        return 1;
    }

    let titles = &mut *(lparam as *mut HashMap<u32, String>);
    titles.entry(pid).or_insert(title);
    1 // keep enumerating
}

/// Full path of the executable backing `pid`, or `None` if it can't be
/// resolved (exited, elevated, or access denied).
#[cfg(target_os = "windows")]
fn exe_path(pid: u32) -> Option<PathBuf> {
    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };

    let handle: HANDLE = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
    if handle.is_null() {
        return None;
    }

    let mut buf = [0u16; 1024];
    let mut size = buf.len() as u32;
    let ok = unsafe {
        QueryFullProcessImageNameW(handle, PROCESS_NAME_WIN32, buf.as_mut_ptr(), &mut size)
    } != 0;
    unsafe { CloseHandle(handle) };

    if !ok || size == 0 {
        return None;
    }
    Some(PathBuf::from(OsString::from_wide(&buf[..size as usize])))
}

/// Friendly display name from the exe's version resource: `FileDescription`,
/// falling back to `ProductName` (both via the file's translation table, then
/// a hard-coded en-US/1252 path). `None` when the exe has no version info.
#[cfg(target_os = "windows")]
fn friendly_name_from_path(path: &std::path::Path) -> Option<String> {
    use windows_sys::Win32::Storage::FileSystem::{GetFileVersionInfoSizeW, GetFileVersionInfoW};

    let wide = to_wide(path.as_os_str())?;
    let size = unsafe { GetFileVersionInfoSizeW(wide.as_ptr(), std::ptr::null_mut()) };
    if size == 0 {
        return None;
    }

    let mut data = vec![0u8; size as usize];
    if unsafe {
        GetFileVersionInfoW(
            wide.as_ptr(),
            0,
            size,
            data.as_mut_ptr() as *mut core::ffi::c_void,
        )
    } == 0
    {
        return None;
    }

    let mut subblocks: Vec<String> = Vec::new();
    if let Some((lang, codepage)) = translation_table(&data) {
        subblocks.push(format!(
            "\\StringFileInfo\\{lang:04x}{codepage:04x}\\FileDescription"
        ));
        subblocks.push(format!(
            "\\StringFileInfo\\{lang:04x}{codepage:04x}\\ProductName"
        ));
    }
    subblocks.push("\\StringFileInfo\\080904b0\\FileDescription".to_string());
    subblocks.push("\\StringFileInfo\\080904b0\\ProductName".to_string());

    for sub in subblocks {
        if let Some(s) = ver_query_string(&data, &sub) {
            if !s.trim().is_empty() {
                return Some(s);
            }
        }
    }
    None
}

/// First `(lang, codepage)` pair from the version block's translation table.
#[cfg(target_os = "windows")]
fn translation_table(data: &[u8]) -> Option<(u16, u16)> {
    let raw = ver_query(data, "\\VarFileInfo\\Translation")?;
    if raw.len() < 4 {
        return None;
    }
    let pair = u32::from_le_bytes([raw[0], raw[1], raw[2], raw[3]]);
    Some(((pair & 0xffff) as u16, ((pair >> 16) & 0xffff) as u16))
}

/// Raw bytes of a version subblock, if present.
#[cfg(target_os = "windows")]
fn ver_query<'a>(data: &'a [u8], sub: &str) -> Option<&'a [u8]> {
    use windows_sys::Win32::Storage::FileSystem::VerQueryValueW;

    let wide = to_wide(std::ffi::OsStr::new(sub))?;
    let mut buf: *mut core::ffi::c_void = std::ptr::null_mut();
    let mut len: u32 = 0;
    let ok = unsafe {
        VerQueryValueW(
            data.as_ptr() as *const core::ffi::c_void,
            wide.as_ptr(),
            &mut buf,
            &mut len,
        )
    } != 0;
    if !ok || buf.is_null() || len == 0 {
        return None;
    }
    Some(unsafe { std::slice::from_raw_parts(buf as *const u8, len as usize) })
}

/// UTF-16 string value of a version subblock (up to its NUL terminator).
#[cfg(target_os = "windows")]
fn ver_query_string(data: &[u8], sub: &str) -> Option<String> {
    let raw = ver_query(data, sub)?;
    let mut end = 0;
    while end + 1 < raw.len() && !(raw[end] == 0 && raw[end + 1] == 0) {
        end += 2;
    }
    let words: Vec<u16> = raw[..end]
        .chunks_exact(2)
        .map(|c| u16::from_le_bytes([c[0], c[1]]))
        .collect();
    let s = String::from_utf16_lossy(&words);
    (!s.trim().is_empty()).then_some(s)
}

/// Null-terminated wide encoding of an OS string.
#[cfg(target_os = "windows")]
fn to_wide(s: &std::ffi::OsStr) -> Option<Vec<u16>> {
    use std::os::windows::ffi::OsStrExt;

    let mut wide: Vec<u16> = s.encode_wide().collect();
    if wide.is_empty() {
        return None;
    }
    wide.push(0);
    Some(wide)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn proc(name: &str, title: Option<&str>, friendly: Option<&str>) -> ProcessInfo {
        ProcessInfo {
            pid: 1,
            name: name.to_string(),
            title: title.map(str::to_string),
            friendly: friendly.map(str::to_string),
        }
    }

    #[test]
    fn dedupe_collapses_same_name_case_insensitively() {
        let out = dedupe_for_picker(vec![
            proc("Main.exe", None, None),
            proc("MAIN.EXE", Some("MU Online"), None),
            proc("main.exe", None, None),
        ]);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].name, "Main.exe");
        // Title adopted from the later instance (first had none).
        assert_eq!(out[0].title.as_deref(), Some("MU Online"));
    }

    #[test]
    fn dedupe_adopts_friendly_name_from_later_instance() {
        let out = dedupe_for_picker(vec![
            proc("main.exe", Some("MU Online"), None),
            proc("MAIN.EXE", None, Some("Hamin Client")),
        ]);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].title.as_deref(), Some("MU Online"));
        assert_eq!(out[0].friendly.as_deref(), Some("Hamin Client"));
    }

    #[test]
    fn dedupe_keeps_first_title_and_friendly() {
        let out = dedupe_for_picker(vec![
            proc("main.exe", Some("MU Online"), Some("Hamin Client")),
            proc("MAIN.EXE", Some("MU Online 2"), Some("Hamin Client 2")),
        ]);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].title.as_deref(), Some("MU Online"));
        assert_eq!(out[0].friendly.as_deref(), Some("Hamin Client"));
    }

    #[test]
    fn dedupe_sorts_case_insensitively() {
        let out = dedupe_for_picker(vec![
            proc("Zebra.exe", None, None),
            proc("alpha.exe", None, None),
            proc("Bravo.exe", None, None),
        ]);
        let names: Vec<&str> = out.iter().map(|p| p.name.as_str()).collect();
        assert_eq!(names, vec!["alpha.exe", "Bravo.exe", "Zebra.exe"]);
    }

    #[test]
    fn process_name_matches_ignores_case_and_exe_suffix() {
        assert!(process_name_matches("main.exe", "MAIN.EXE"));
        assert!(process_name_matches("main", "Main.exe"));
        assert!(process_name_matches("MAIN.EXE", "main"));
        assert!(!process_name_matches("main.exe", "chrome.exe"));
        assert!(!process_name_matches("main", "mainframe.exe"));
    }

    #[test]
    fn wchar_array_reads_up_to_nul() {
        let arr = [b'm'.into(), b'a'.into(), 0, b'x'.into()];
        assert_eq!(wchar_array_to_string(&arr), "ma");
        let full = [b'a'.into(), b'b'.into()];
        assert_eq!(wchar_array_to_string(&full), "ab");
    }
}
