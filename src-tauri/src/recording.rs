// src-tauri/src/recording.rs
// Basic video recording (Phase 1: video-only, Phase 2: add audio)
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordOptions {
    pub format: Option<String>,
    pub fps: Option<u32>,
    pub display_id: Option<i32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingHandle {
    pub id: String,
    pub start_time: i64,
}

struct RecordingState {
    handle: RecordingHandle,
    fps: u32,
    display_id: Option<i32>,
    stop_flag: Arc<Mutex<bool>>,
    frames: Arc<Mutex<Vec<Vec<u8>>>>,
}

lazy_static::lazy_static! {
    static ref ACTIVE_RECORDINGS: Arc<Mutex<HashMap<String, RecordingState>>> =
        Arc::new(Mutex::new(HashMap::new()));
}

pub fn start_recording(options: RecordOptions) -> Result<RecordingHandle, String> {
    let handle = RecordingHandle {
        id: format!("rec_{}", chrono::Utc::now().timestamp_millis()),
        start_time: chrono::Utc::now().timestamp_millis(),
    };

    let fps = options.fps.unwrap_or(30);
    let display_id = options.display_id;

    println!("[Recording] Starting video recording: {}", handle.id);
    println!("[Recording] FPS: {}, Display: {:?}", fps, display_id);

    let stop_flag = Arc::new(Mutex::new(false));
    let frames = Arc::new(Mutex::new(Vec::new()));

    let state = RecordingState {
        handle: handle.clone(),
        fps,
        display_id,
        stop_flag: stop_flag.clone(),
        frames: frames.clone(),
    };

    // Store state
    let mut recordings = ACTIVE_RECORDINGS.lock().map_err(|e| e.to_string())?;
    recordings.insert(handle.id.clone(), state);
    drop(recordings);

    // Start recording thread
    let handle_clone = handle.clone();
    thread::spawn(move || {
        record_frames(handle_clone.id, fps, display_id, stop_flag, frames);
    });

    Ok(handle)
}

fn record_frames(
    recording_id: String,
    fps: u32,
    display_id: Option<i32>,
    stop_flag: Arc<Mutex<bool>>,
    frames: Arc<Mutex<Vec<Vec<u8>>>>,
) {
    use crate::commands::capture_screen_internal;

    let frame_duration = Duration::from_millis(1000 / fps as u64);
    let mut frame_count = 0;

    println!("[Recording] Recording thread started for {}", recording_id);

    loop {
        let start = Instant::now();

        // Check stop flag
        if let Ok(flag) = stop_flag.lock() {
            if *flag {
                println!("[Recording] Stop flag set, ending recording");
                break;
            }
        }

        // Capture frame
        match capture_screen_internal(display_id) {
            Ok(frame_data) => {
                if let Ok(mut frames_vec) = frames.lock() {
                    frames_vec.push(frame_data);
                    frame_count += 1;

                    if frame_count % (fps * 5) == 0 {
                        println!("[Recording] Captured {} frames", frame_count);
                    }
                }
            }
            Err(e) => {
                eprintln!("[Recording] Frame capture failed: {}", e);
            }
        }

        // Sleep for remaining frame time
        let elapsed = start.elapsed();
        if elapsed < frame_duration {
            thread::sleep(frame_duration - elapsed);
        }
    }

    println!("[Recording] Recording thread ended. Total frames: {}", frame_count);
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

    // Wait a bit for thread to finish
    thread::sleep(Duration::from_millis(500));

    // Get frames
    let frames_vec = state.frames.lock()
        .map_err(|e| e.to_string())?
        .clone();

    println!("[Recording] Captured {} frames total", frames_vec.len());

    // TODO: Encode frames to video
    // For now, return error asking to use browser version
    Err(format!(
        "Video encoding not yet implemented. Captured {} frames at {}fps. Use web version for now.",
        frames_vec.len(),
        state.fps
    ))
}
