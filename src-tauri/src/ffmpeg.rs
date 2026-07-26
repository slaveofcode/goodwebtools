// src-tauri/src/ffmpeg.rs
// Resolves the FFmpeg binary path — bundled sidecar first, then system PATH.

use std::path::PathBuf;

/// Returns the path to the FFmpeg binary to use.
/// Prefers the bundled sidecar in `bin/`, falls back to the system `ffmpeg`.
pub fn ffmpeg_path() -> PathBuf {
    // Look for a sidecar binary next to the app executable
    if let Ok(exe) = std::env::current_exe() {
        let bin_dir = exe.parent().unwrap_or(exe.as_path());

        #[cfg(target_os = "windows")]
        let candidate = bin_dir.join("ffmpeg.exe");
        #[cfg(not(target_os = "windows"))]
        let candidate = bin_dir.join("ffmpeg");

        if candidate.exists() {
            println!("[FFmpeg] Using bundled binary: {}", candidate.display());
            return candidate;
        }
    }

    // Fall back to system ffmpeg
    println!("[FFmpeg] Using system ffmpeg");
    PathBuf::from("ffmpeg")
}

/// Returns `true` if FFmpeg is available (bundled or system).
pub fn is_available() -> bool {
    let path = ffmpeg_path();
    std::process::Command::new(&path)
        .arg("-version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}
