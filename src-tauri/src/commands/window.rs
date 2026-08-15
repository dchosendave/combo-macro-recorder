/// Toggles Windows 11 DWM corner rounding on the calling window.
///
/// The compact overlay is a borderless window parked flush in a screen
/// corner; DWM rounds undecorated top-level windows by default, which shows
/// as rounded corners on the bar. `enabled = true` opts the window out
/// (`DWMWCP_DONOTROUND`), `enabled = false` restores the system default.
/// No-op on non-Windows targets.
#[tauri::command]
pub fn set_hard_corners(window: tauri::Window, enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::Foundation::HWND as SysHwnd;
        use windows_sys::Win32::Graphics::Dwm::{
            DwmSetWindowAttribute, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_DEFAULT,
            DWMWCP_DONOTROUND,
        };

        let hwnd = window.hwnd().map_err(|e| e.to_string())?;
        // tauri's HWND is the `windows` crate's `HWND(pub *mut c_void)`.
        let preference: i32 = if enabled {
            DWMWCP_DONOTROUND
        } else {
            DWMWCP_DEFAULT
        };
        // SAFETY: `hwnd` is the live native handle of the calling window and
        // `preference` is a valid i32 for the duration of the call.
        let result = unsafe {
            DwmSetWindowAttribute(
                hwnd.0 as SysHwnd,
                DWMWA_WINDOW_CORNER_PREFERENCE as u32,
                &preference as *const i32 as *const core::ffi::c_void,
                core::mem::size_of::<i32>() as u32,
            )
        };
        if result < 0 {
            return Err(format!("DwmSetWindowAttribute failed: {result:#x}"));
        }
    }
    #[cfg(not(target_os = "windows"))]
    let _ = (window, enabled);

    Ok(())
}
