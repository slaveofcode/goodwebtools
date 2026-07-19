// src-tauri/src/audio.rs
// Real audio capture via FFmpeg subprocess — mic + muxing with video

use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};

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
            // Send 'q' to FFmpeg stdin to trigger a graceful shutdown
            // (FFmpeg reads from stdin when `-nostdin` is not set)
            let _ = child.wait(); // Just wait — we already sent SIGTERM via kill()
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
        let extension = match format {
            "mp4" => "mp4",
            _ => "webm",
        };
        let output_path = video_path.with_extension(format!("muxed.{}", extension));

        println!(
            "[Audio] Muxing video={} audio={} → {}",
            video_path.display(),
            audio_path.display(),
            output_path.display()
        );

        let status = Command::new("ffmpeg")
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
        Command::new("ffmpeg")
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
        Command::new("ffmpeg")
            .args([
                "-y",
                "-f", "dshow",
                "-i", "audio=@device_cm_{33D9A762-90C8-11D0-BD43-00A0C911CE86}\\wave_{...}",
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
        let result = Command::new("ffmpeg")
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
                Command::new("ffmpeg")
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
