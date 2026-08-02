use std::path::{Path, PathBuf};
use std::process::Command;

/// Locates rc.exe from the latest installed Windows SDK.
fn find_rc() -> Option<PathBuf> {
    if let Ok(custom) = std::env::var("RC") {
        let p = PathBuf::from(custom);
        if p.is_file() {
            return Some(p);
        }
    }
    for key in [
        "HKLM\\SOFTWARE\\Microsoft\\Windows Kits\\Installed Roots",
        "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows Kits\\Installed Roots",
    ] {
        let out = Command::new("reg.exe").args(["query", key, "/v", "KitsRoot10"]).output().ok()?;
        if !out.status.success() {
            continue;
        }
        let text = String::from_utf8_lossy(&out.stdout);
        if let Some(line) = text.lines().find(|l| l.contains("KitsRoot10")) {
            if let Some(idx) = line.find("REG_SZ") {
                let root = line[idx + "REG_SZ".len()..].trim();
                let bin = PathBuf::from(root).join("bin");
                let mut best: Option<(u64, PathBuf)> = None;
                for entry in std::fs::read_dir(bin).ok()?.flatten() {
                    let ver = entry.file_name().to_string_lossy().into_owned();
                    let ver_num: u64 = ver
                        .split('.')
                        .filter_map(|p| p.parse::<u64>().ok())
                        .fold(0u64, |acc, n| acc * 1000 + n);
                    let candidate = entry.path().join("x64").join("rc.exe");
                    if candidate.is_file() && best.as_ref().map_or(true, |(v, _)| ver_num > *v) {
                        best = Some((ver_num, candidate));
                    }
                }
                return best.map(|(_, p)| p);
            }
        }
    }
    None
}

/// Embeds the Common-Controls v6 app manifest into every linked artifact
/// (including Rust TEST binaries, which have no manifest by default).
///
/// Why this is needed: tauri pulls in code that statically imports
/// `comctl32!TaskDialogIndirect`, an export that only exists in the v6 WinSxS
/// common controls. The System32 `comctl32.dll` is a v5.82 stub without it, and
/// the v6 copy is only activated when an application manifest declares the
/// `Microsoft.Windows.Common-Controls` dependency. App binaries get that
/// manifest from tauri-build; test binaries don't, so `cargo test` crashes at
/// load with STATUS_ENTRYPOINT_NOT_FOUND (0xc0000139) on Windows. See
/// tauri-apps/tauri#13419 and #11028.
fn embed_windows_controls_manifest() {
    if std::env::var("CARGO_CFG_TARGET_ENV").as_deref() != Ok("msvc") {
        return;
    }

    let out_dir = std::env::var("OUT_DIR").unwrap();
    let manifest_path = Path::new(&out_dir).join("app.manifest");
    let rc_path = Path::new(&out_dir).join("app.rc");
    std::fs::write(
        &manifest_path,
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <dependency>
    <dependentAssembly>
      <assemblyIdentity
        type="win32"
        name="Microsoft.Windows.Common-Controls"
        version="6.0.0.0"
        processorArchitecture="*"
        publicKeyToken="6595b64144ccf1df"
        language="*"
      />
    </dependentAssembly>
  </dependency>
</assembly>"#,
    )
    .unwrap();

    // rc.exe interprets backslashes as C escapes, so use forward slashes.
    let manifest_rc = manifest_path.display().to_string().replace('\\', "/");
    // LANG_NEUTRAL avoids colliding with tauri-build's manifest resource
    // (MANIFEST id 1, language 0x0409) which is linked into binary targets.
    std::fs::write(
        &rc_path,
        format!("LANGUAGE 0, 0\n1 24 \"{}\"\n", manifest_rc),
    )
    .unwrap();

    let rc = find_rc().expect("rc.exe not found; install the Windows SDK");
    let res_path = Path::new(&out_dir).join("app.res");
    let status = Command::new(&rc)
        .args(["/fo", res_path.to_str().unwrap(), rc_path.to_str().unwrap()])
        .status()
        .expect("failed to run rc.exe");
    assert!(status.success(), "rc.exe failed to compile the manifest resource");

    // Unqualified link-arg: cargo applies it to every artifact, including the
    // lib test harness (targeted directives like rustc-link-arg-tests do not
    // reach it).
    println!("cargo:rustc-link-arg={out_dir}\\app.res");
}

fn main() {
    tauri_build::build();
    embed_windows_controls_manifest();
}
