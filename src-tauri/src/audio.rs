// src-tauri/src/audio.rs
// Real audio capture via FFmpeg subprocess — mic + muxing with video

use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use crate::ffmpeg::ffmpeg_path;

/// A running FFmpeg audio capture process.
pub struct AudioRecorder {
    process: Arc<Mutex<Option<Child>>>,
    pub output_path: PathBuf,
}

impl AudioRecorder {
    /// Start capturing microphone audio to `output_path` (should end in .aac).
    pub fn start(output_path: PathBuf, include_mic: bool, include_system: bool) -> Result<Self, String> {
        if !include_mic && !include_system {
            // Nothing requested — return a no-op recorder with a dummy path
            return Ok(Self { process: Arc::new(Mutex::new(None)), output_path });
        }

        let child = Self::spawn_ffmpeg(&output_path, include_mic, include_system)?;
        println!("[Audio] Capture started → {}", output_path.display());

        Ok(Self {
            process: Arc::new(Mutex::new(Some(child))),
            output_path,
        })
    }

    /// Stop the FFmpeg process and return the path to the captured audio file.
    /// Returns `None` when no audio was recorded (no-op recorder).
    pub fn stop(&self) -> Option<PathBuf> {
        let mut guard = self.process.lock().ok()?;

        if let Some(ref mut child) = *guard {
            // Ask FFmpeg to finalize gracefully by sending 'q' to its stdin, so
            // it flushes and writes a proper file trailer before exiting.
            if let Some(stdin) = child.stdin.as_mut() {
                let _ = stdin.write_all(b"q\n");
                let _ = stdin.flush();
            }
            // Drop stdin to signal EOF, giving FFmpeg a chance to exit on its own.
            drop(child.stdin.take());

            // Give it a brief window to exit cleanly, then force-kill so stop()
            // can never block indefinitely on a live capture that won't self-exit.
            thread::sleep(Duration::from_millis(500));
            let _ = child.kill();
            let _ = child.wait();
            println!("[Audio] Capture stopped");

            if self.output_path.exists() {
                return Some(self.output_path.clone());
            }
        }

        None
    }

    /// Mux a video file and an audio file into a single output file via FFmpeg.
    /// `video_path` and `audio_path` are consumed (temp files). Returns muxed bytes.
    pub fn mux(video_path: &Path, audio_path: &Path, format: &str) -> Result<Vec<u8>, String> {
        let extension = muxed_extension(format);
        let output_path = video_path.with_extension(format!("muxed.{}", extension));

        println!(
            "[Audio] Muxing video={} audio={} → {}",
            video_path.display(),
            audio_path.display(),
            output_path.display()
        );

        let status = Command::new(ffmpeg_path())
            .args([
                "-y",
                "-i", &video_path.to_string_lossy(),
                "-i", &audio_path.to_string_lossy(),
                "-c:v", "copy",
                "-c:a", "aac",
                "-shortest",
                &output_path.to_string_lossy(),
            ])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map_err(|e| format!("FFmpeg mux failed to start: {}", e))?;

        if !status.success() {
            return Err("FFmpeg mux failed".to_string());
        }

        let data = std::fs::read(&output_path)
            .map_err(|e| format!("Failed to read muxed file: {}", e))?;

        let _ = std::fs::remove_file(&output_path);
        println!("[Audio] Muxed output: {} bytes", data.len());
        Ok(data)
    }

    // ── Private ──────────────────────────────────────────────────────────────

    fn spawn_ffmpeg(output: &Path, include_mic: bool, _include_system: bool) -> Result<Child, String> {
        #[cfg(target_os = "macos")]
        {
            Self::spawn_ffmpeg_macos(output, include_mic)
        }
        #[cfg(target_os = "windows")]
        {
            Self::spawn_ffmpeg_windows(output, include_mic)
        }
        #[cfg(target_os = "linux")]
        {
            Self::spawn_ffmpeg_linux(output, include_mic)
        }
        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        {
            let _ = (output, include_mic);
            Err("Audio capture not supported on this platform".to_string())
        }
    }

    #[cfg(target_os = "macos")]
    fn spawn_ffmpeg_macos(output: &Path, _include_mic: bool) -> Result<Child, String> {
        // AVFoundation device index 0 = default microphone
        Command::new(ffmpeg_path())
            .args([
                "-y",
                "-f", "avfoundation",
                "-i", ":0",          // audio-only input (no video)
                "-vn",               // no video in this output
                "-acodec", "aac",
                "-b:a", "128k",
                &output.to_string_lossy(),
            ])
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to start FFmpeg (macOS audio): {}. Install with: brew install ffmpeg", e))
    }

    #[cfg(target_os = "windows")]
    fn spawn_ffmpeg_windows(output: &Path, _include_mic: bool) -> Result<Child, String> {
        // Enumerate real DirectShow audio devices instead of a hardcoded GUID.
        let device = first_dshow_audio_device().ok_or_else(|| {
            "No DirectShow audio capture device found. Connect and enable a microphone.".to_string()
        })?;
        let input = format!("audio={}", device);
        println!("[Audio] Using DirectShow device: {}", device);

        Command::new(ffmpeg_path())
            .args([
                "-y",
                "-f", "dshow",
                "-i", &input,
                "-vn",
                "-acodec", "aac",
                "-b:a", "128k",
                &output.to_string_lossy(),
            ])
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to start FFmpeg (Windows audio): {}", e))
    }

    #[cfg(target_os = "linux")]
    fn spawn_ffmpeg_linux(output: &Path, _include_mic: bool) -> Result<Child, String> {
        // Try PulseAudio first, fall back to ALSA
        let result = Command::new(ffmpeg_path())
            .args([
                "-y",
                "-f", "pulse",
                "-i", "default",
                "-vn",
                "-acodec", "aac",
                "-b:a", "128k",
                &output.to_string_lossy(),
            ])
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn();

        match result {
            Ok(child) => Ok(child),
            Err(_) => {
                // Fallback: ALSA
                Command::new(ffmpeg_path())
                    .args([
                        "-y",
                        "-f", "alsa",
                        "-i", "default",
                        "-vn",
                        "-acodec", "aac",
                        "-b:a", "128k",
                        &output.to_string_lossy(),
                    ])
                    .stdin(Stdio::piped())
                    .stdout(Stdio::null())
                    .stderr(Stdio::null())
                    .spawn()
                    .map_err(|e| format!("Failed to start FFmpeg (Linux audio): {}. Install with: sudo apt install ffmpeg", e))
            }
        }
    }
}

/// Map a requested container format to the muxed output file extension.
/// Anything other than "mp4" falls back to "webm".
fn muxed_extension(format: &str) -> &'static str {
    match format {
        "mp4" => "mp4",
        _ => "webm",
    }
}

/// Return the first quoted substring on a line, or `None` if there isn't a pair.
/// e.g. `[dshow] "Microphone (Realtek)" (audio)` → `Microphone (Realtek)`.
#[allow(dead_code)]
fn extract_first_quoted(line: &str) -> Option<String> {
    let start = line.find('"')?;
    let rest = &line[start + 1..];
    let end = rest.find('"')?;
    Some(rest[..end].to_string())
}

/// Parse the friendly names of DirectShow **audio** capture devices from the
/// stderr FFmpeg prints for `-list_devices true -f dshow -i dummy`.
///
/// Handles both output styles:
///   - Newer FFmpeg (5.x+): each device line is tagged inline, e.g. `... "Mic" (audio)`
///   - Older FFmpeg (4.x):  devices are grouped under a `DirectShow audio devices` header
///
/// "Alternative name" lines and video devices are excluded.
#[allow(dead_code)]
fn parse_dshow_audio_devices(stderr: &str) -> Vec<String> {
    let mut devices = Vec::new();
    let mut in_audio_section = false;

    for line in stderr.lines() {
        let lower = line.to_lowercase();

        // Section headers (older FFmpeg group style)
        if lower.contains("directshow audio devices") {
            in_audio_section = true;
            continue;
        }
        if lower.contains("directshow video devices") {
            in_audio_section = false;
            continue;
        }
        // The alternative-name line carries the @device_... string, not a friendly name.
        if lower.contains("alternative name") {
            continue;
        }

        if let Some(name) = extract_first_quoted(line) {
            if lower.contains("(audio)") {
                devices.push(name); // newer inline tag
            } else if lower.contains("(video)") {
                // explicitly a video device — skip
            } else if in_audio_section {
                devices.push(name); // older grouped style
            }
        }
    }

    devices
}

/// Query FFmpeg for the first available DirectShow audio capture device.
/// FFmpeg exits non-zero for the dummy input — that's expected; we only read stderr.
#[cfg(target_os = "windows")]
fn first_dshow_audio_device() -> Option<String> {
    let output = Command::new(ffmpeg_path())
        .args(["-hide_banner", "-list_devices", "true", "-f", "dshow", "-i", "dummy"])
        .stdin(Stdio::null())
        .output()
        .ok()?;
    let stderr = String::from_utf8_lossy(&output.stderr);
    parse_dshow_audio_devices(&stderr).into_iter().next()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn muxed_extension_maps_mp4() {
        assert_eq!(muxed_extension("mp4"), "mp4");
    }

    #[test]
    fn muxed_extension_defaults_to_webm() {
        assert_eq!(muxed_extension("webm"), "webm");
        assert_eq!(muxed_extension("mkv"), "webm");
        assert_eq!(muxed_extension(""), "webm");
    }

    #[test]
    fn start_with_no_sources_is_noop() {
        // When neither mic nor system audio is requested, start() must succeed
        // without spawning FFmpeg and must not error even if FFmpeg is absent.
        let path = std::env::temp_dir().join("gwt_test_noop.aac");
        let recorder = AudioRecorder::start(path.clone(), false, false)
            .expect("no-op recorder should always start");
        assert_eq!(recorder.output_path, path);
    }

    #[test]
    fn noop_recorder_stop_returns_none() {
        // A no-op recorder captured nothing, so stop() must return None
        // rather than pointing at a non-existent file.
        let path = std::env::temp_dir().join("gwt_test_noop_stop.aac");
        let recorder = AudioRecorder::start(path, false, false).unwrap();
        assert_eq!(recorder.stop(), None);
    }

    #[test]
    fn noop_recorder_stop_is_idempotent() {
        // Calling stop() twice on a no-op recorder must stay None and not panic.
        let path = std::env::temp_dir().join("gwt_test_noop_twice.aac");
        let recorder = AudioRecorder::start(path, false, false).unwrap();
        assert_eq!(recorder.stop(), None);
        assert_eq!(recorder.stop(), None);
    }

    #[test]
    fn output_path_is_preserved() {
        // The recorder must remember exactly the path it was given.
        let path = std::env::temp_dir().join("gwt_test_custom_name.aac");
        let recorder = AudioRecorder::start(path.clone(), false, false).unwrap();
        assert_eq!(recorder.output_path, path);
        assert_eq!(recorder.output_path.extension().unwrap(), "aac");
    }

    #[test]
    fn extract_first_quoted_pulls_device_name() {
        assert_eq!(
            extract_first_quoted(r#"[dshow @ 0] "Microphone (Realtek)" (audio)"#),
            Some("Microphone (Realtek)".to_string())
        );
    }

    #[test]
    fn extract_first_quoted_none_when_unquoted() {
        assert_eq!(extract_first_quoted("[dshow @ 0] no quotes here"), None);
        assert_eq!(extract_first_quoted(r#"only one " quote"#), None);
    }

    #[test]
    fn parse_dshow_newer_inline_format() {
        // FFmpeg 5.x/6.x tags each device line with (video)/(audio) inline.
        let stderr = r#"[dshow @ 000] "Integrated Webcam" (video)
[dshow @ 000]   Alternative name "@device_pnp_\\?\usb#vid_0000"
[dshow @ 000] "Microphone (Realtek(R) Audio)" (audio)
[dshow @ 000]   Alternative name "@device_cm_{33D9A762}\wave_{ABCD}"
[dshow @ 000] "Stereo Mix (Realtek(R) Audio)" (audio)
[dshow @ 000]   Alternative name "@device_cm_{33D9A762}\wave_{EFGH}""#;

        let devices = parse_dshow_audio_devices(stderr);
        assert_eq!(
            devices,
            vec![
                "Microphone (Realtek(R) Audio)".to_string(),
                "Stereo Mix (Realtek(R) Audio)".to_string(),
            ]
        );
    }

    #[test]
    fn parse_dshow_older_grouped_format() {
        // FFmpeg 4.x groups devices under section headers with no inline tag.
        let stderr = r#"[dshow @ 000] DirectShow video devices (some may be both video and audio devices)
[dshow @ 000]  "Integrated Webcam"
[dshow @ 000]     Alternative name "@device_pnp_\\?\usb#vid_0000"
[dshow @ 000] DirectShow audio devices
[dshow @ 000]  "Microphone (Realtek(R) Audio)"
[dshow @ 000]     Alternative name "@device_cm_{33D9A762}\wave_{ABCD}""#;

        let devices = parse_dshow_audio_devices(stderr);
        assert_eq!(devices, vec!["Microphone (Realtek(R) Audio)".to_string()]);
    }

    #[test]
    fn parse_dshow_no_audio_devices() {
        // Only a webcam present → no audio devices returned.
        let stderr = r#"[dshow @ 000] DirectShow video devices
[dshow @ 000]  "Integrated Webcam"
[dshow @ 000]     Alternative name "@device_pnp_\\?\usb#vid_0000"
[dshow @ 000] DirectShow audio devices"#;

        assert!(parse_dshow_audio_devices(stderr).is_empty());
    }

    #[test]
    fn parse_dshow_excludes_alternative_names() {
        // Alternative-name lines must never be mistaken for a device name.
        let stderr = r#"[dshow @ 000] "Mic" (audio)
[dshow @ 000]   Alternative name "@device_cm_{SHOULD_NOT_APPEAR}""#;

        let devices = parse_dshow_audio_devices(stderr);
        assert_eq!(devices, vec!["Mic".to_string()]);
        assert!(!devices.iter().any(|d| d.contains("device_cm")));
    }

    #[test]
    fn parse_dshow_empty_input() {
        assert!(parse_dshow_audio_devices("").is_empty());
    }
}
