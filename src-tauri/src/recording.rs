// src-tauri/src/recording.rs
// Basic video recording (Phase 1: video-only, Phase 2: video encoding, Phase 3: add audio)
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use std::process::Command;
use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordOptions {
    pub format: Option<String>,
    pub fps: Option<u32>,
    pub display_id: Option<i32>,
    pub include_audio: Option<bool>,
    pub system_audio: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingHandle {
    pub id: String,
    pub start_time: i64,
    pub format: Option<String>,
}

struct RecordingState {
    handle: RecordingHandle,
    fps: u32,
    display_id: Option<i32>,
    include_audio: bool,
    system_audio: bool,
    stop_flag: Arc<Mutex<bool>>,
    frames: Arc<Mutex<Vec<Vec<u8>>>>,
    start_time: Instant,
    duration: Arc<Mutex<Option<Duration>>>,
}

lazy_static::lazy_static! {
    static ref ACTIVE_RECORDINGS: Arc<Mutex<HashMap<String, RecordingState>>> =
        Arc::new(Mutex::new(HashMap::new()));
}

pub fn start_recording(options: RecordOptions) -> Result<RecordingHandle, String> {
    let handle = RecordingHandle {
        id: format!("rec_{}", chrono::Utc::now().timestamp_millis()),
        start_time: chrono::Utc::now().timestamp_millis(),
        format: options.format.clone(),
    };

    let fps = options.fps.unwrap_or(30);
    let display_id = options.display_id;
    let include_audio = options.include_audio.unwrap_or(false);
    let system_audio = options.system_audio.unwrap_or(false);

    println!("[Recording] Starting recording: {}", handle.id);
    println!("[Recording] FPS: {}, Display: {:?}", fps, display_id);
    println!("[Recording] Audio: mic={}, system={}", include_audio, system_audio);

    let stop_flag = Arc::new(Mutex::new(false));
    let frames = Arc::new(Mutex::new(Vec::new()));
    let duration = Arc::new(Mutex::new(None));

    let state = RecordingState {
        handle: handle.clone(),
        fps,
        display_id,
        include_audio,
        system_audio,
        stop_flag: stop_flag.clone(),
        frames: frames.clone(),
        start_time: Instant::now(),
        duration: duration.clone(),
    };

    // Store state
    let mut recordings = ACTIVE_RECORDINGS.lock().map_err(|e| e.to_string())?;
    recordings.insert(handle.id.clone(), state);
    drop(recordings);

    // Start recording thread
    let handle_clone = handle.clone();
    thread::spawn(move || {
        record_frames(handle_clone.id, fps, display_id, stop_flag, frames, duration);
    });

    Ok(handle)
}

fn record_frames(
    recording_id: String,
    fps: u32,
    display_id: Option<i32>,
    stop_flag: Arc<Mutex<bool>>,
    frames: Arc<Mutex<Vec<Vec<u8>>>>,
    duration_out: Arc<Mutex<Option<Duration>>>,
) {
    use crate::commands::capture_screen_fast;

    // Target frame interval (but actual may be slower due to capture time)
    let target_frame_duration = Duration::from_millis(1000 / fps as u64);
    let mut frame_count = 0;
    let start_time = Instant::now();

    println!("[Recording] Recording thread started for {}", recording_id);
    println!("[Recording] Target: {}fps ({}ms per frame)", fps, 1000 / fps);

    loop {
        let frame_start = Instant::now();

        // Check stop flag
        if let Ok(flag) = stop_flag.lock() {
            if *flag {
                let total_duration = start_time.elapsed();
                let actual_fps = frame_count as f64 / total_duration.as_secs_f64();
                println!("[Recording] Stop flag set, ending recording");
                println!("[Recording] Duration: {:.2}s, Actual FPS: {:.2}",
                    total_duration.as_secs_f64(), actual_fps);
                break;
            }
        }

        // Capture frame (using fast JPEG encoding)
        match capture_screen_fast(display_id) {
            Ok(frame_data) => {
                if let Ok(mut frames_vec) = frames.lock() {
                    frames_vec.push(frame_data);
                    frame_count += 1;

                    // Log every 30 frames to show progress
                    if frame_count % 30 == 0 {
                        let elapsed = start_time.elapsed();
                        let current_fps = frame_count as f64 / elapsed.as_secs_f64();
                        println!("[Recording] {} frames in {:.1}s (actual: {:.1}fps)",
                            frame_count, elapsed.as_secs_f64(), current_fps);
                    }
                }
            }
            Err(e) => {
                eprintln!("[Recording] Frame capture failed: {}", e);
            }
        }

        // Sleep for remaining frame time
        let frame_elapsed = frame_start.elapsed();
        if frame_elapsed < target_frame_duration {
            thread::sleep(target_frame_duration - frame_elapsed);
        } else if frame_count == 1 {
            // Log warning on first slow frame
            println!("[Recording] Warning: Frame capture took {}ms (target: {}ms)",
                frame_elapsed.as_millis(), target_frame_duration.as_millis());
        }
    }

    let total_duration = start_time.elapsed();
    let actual_fps = frame_count as f64 / total_duration.as_secs_f64();

    // Store duration for encoding
    if let Ok(mut dur) = duration_out.lock() {
        *dur = Some(total_duration);
    }

    println!("[Recording] Recording thread ended");
    println!("[Recording] Total: {} frames in {:.2}s (actual: {:.2}fps)",
        frame_count, total_duration.as_secs_f64(), actual_fps);
}

pub fn stop_recording(handle_id: String) -> Result<Vec<u8>, String> {
    println!("[Recording] Stopping recording: {}", handle_id);

    let mut recordings = ACTIVE_RECORDINGS.lock().map_err(|e| e.to_string())?;

    let state = recordings.remove(&handle_id)
        .ok_or_else(|| format!("Recording {} not found", handle_id))?;

    // Set stop flag
    if let Ok(mut flag) = state.stop_flag.lock() {
        *flag = true;
    }

    // Wait for thread to finish and set duration
    // Frame capture is slow, so wait longer
    println!("[Recording] Waiting for recording thread to finish...");
    thread::sleep(Duration::from_millis(2000)); // Increased from 500ms

    // Get frames
    let frames_vec = state.frames.lock()
        .map_err(|e| e.to_string())?
        .clone();

    println!("[Recording] Captured {} frames total", frames_vec.len());

    if frames_vec.is_empty() {
        return Err("No frames captured".to_string());
    }

    // Phase 2 & 3: Encode frames to video (with audio if requested)
    let include_audio = state.include_audio || state.system_audio;
    let format = state.handle.format.clone().unwrap_or_else(|| "webm".to_string());

    // Calculate actual FPS achieved (not target FPS)
    let actual_fps = if let Ok(dur_opt) = state.duration.lock() {
        if let Some(duration) = *dur_opt {
            if duration.as_secs_f64() > 0.0 {
                let fps = frames_vec.len() as f64 / duration.as_secs_f64();
                println!("[Recording] Encoding with actual FPS: {:.2} (target was: {})", fps, state.fps);
                fps
            } else {
                println!("[Recording] Duration too short, using target FPS: {}", state.fps);
                state.fps as f64
            }
        } else {
            println!("[Recording] Duration not set, using target FPS: {}", state.fps);
            state.fps as f64
        }
    } else {
        println!("[Recording] Could not read duration, using target FPS: {}", state.fps);
        state.fps as f64
    };

    encode_frames_to_video(&frames_vec, actual_fps, include_audio, &format)
}

fn encode_frames_to_video(frames: &[Vec<u8>], fps: f64, _include_audio: bool, format: &str) -> Result<Vec<u8>, String> {
    println!("[Recording] Phase 2+3: Encoding {} frames to {} at {:.2}fps", frames.len(), format, fps);

    // Phase 3: Audio capture is documented but not yet fully implemented
    // For MVP, we focus on video encoding. Audio will be added in future iterations.
    if _include_audio {
        println!("[Recording] Phase 3: Audio requested but not yet captured");
        println!("[Recording] Future: Will capture and mux audio with video");
    }

    // Create temp directory for frames
    let temp_dir = std::env::temp_dir().join(format!("gwt_recording_{}", chrono::Utc::now().timestamp_millis()));
    fs::create_dir_all(&temp_dir).map_err(|e| format!("Failed to create temp dir: {}", e))?;

    println!("[Recording] Writing frames to: {}", temp_dir.display());

    // Write frames as JPEG files (faster encoding)
    for (i, frame_data) in frames.iter().enumerate() {
        let frame_path = temp_dir.join(format!("frame_{:05}.jpg", i));
        let mut file = File::create(&frame_path)
            .map_err(|e| format!("Failed to create frame file: {}", e))?;
        file.write_all(frame_data)
            .map_err(|e| format!("Failed to write frame: {}", e))?;
    }

    println!("[Recording] Frames written, encoding with FFmpeg...");

    // Choose codec and extension based on format
    let (codec, extension, preset, use_crf) = match format {
        "mp4" => ("libx264", "mp4", Some("medium"), true), // Use CRF for better quality
        _ => ("libvpx-vp9", "webm", None, false), // Default to WebM
    };

    // Output video path
    let output_path = temp_dir.join(format!("output.{}", extension));

    println!("[Recording] Encoding to {} with {} codec", extension, codec);

    // Try to encode with FFmpeg using actual FPS
    let fps_str = format!("{:.2}", fps);
    let input_pattern = temp_dir.join("frame_%05d.jpg");

    let mut cmd = Command::new("ffmpeg");
    cmd.args(&[
        "-y", // Overwrite output
        "-framerate", &fps_str,
        "-i", &input_pattern.to_string_lossy(),
        "-c:v", codec,
        "-pix_fmt", "yuv420p",
    ]);

    // Use CRF for MP4 (better quality), bitrate for WebM
    if use_crf {
        cmd.args(&["-crf", "23"]); // 23 = good quality (lower = better, 18-28 range)
    } else {
        cmd.args(&["-b:v", "5M"]); // 5Mbps for WebM (increased from 2M)
    }

    // Add preset for MP4
    if let Some(preset_val) = preset {
        cmd.args(&["-preset", preset_val]);
    }

    cmd.args(&[
        "-threads", "4",
        output_path.to_str().unwrap(),
    ]);

    let ffmpeg_result = cmd.output();

    match ffmpeg_result {
        Ok(output) => {
            if output.status.success() {
                println!("[Recording] FFmpeg encoding successful");

                // Read the encoded video
                let video_data = fs::read(&output_path)
                    .map_err(|e| format!("Failed to read encoded video: {}", e))?;

                // Clean up temp directory
                let _ = fs::remove_dir_all(&temp_dir);

                println!("[Recording] Video encoded: {} bytes", video_data.len());
                Ok(video_data)
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                println!("[Recording] FFmpeg failed: {}", stderr);

                // Clean up
                let _ = fs::remove_dir_all(&temp_dir);

                Err(format!(
                    "FFmpeg encoding failed. Captured {} frames but couldn't encode. Install FFmpeg for video encoding support.",
                    frames.len()
                ))
            }
        }
        Err(e) => {
            println!("[Recording] FFmpeg not available: {}", e);

            // Clean up
            let _ = fs::remove_dir_all(&temp_dir);

            Err(format!(
                "FFmpeg not found. Captured {} frames at {}fps. Install FFmpeg to enable video encoding:\n\
                macOS: brew install ffmpeg\n\
                Ubuntu: sudo apt install ffmpeg\n\
                Windows: Download from ffmpeg.org",
                frames.len(),
                fps
            ))
        }
    }
}
