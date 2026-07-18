// src-tauri/src/commands.rs
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureOptions {
    pub format: Option<String>,
    pub quality: Option<f32>,
    pub include_audio: Option<bool>,
    pub system_audio: Option<bool>,
    pub display_id: Option<i32>,
    pub scale: Option<f32>, // Resolution scale factor (0.5 = 50%, 1.0 = 100%)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplayInfo {
    pub id: i32,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub is_main: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rectangle {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordOptions {
    pub format: Option<String>,
    pub video_bitrate: Option<u32>,
    pub audio_bitrate: Option<u32>,
    pub include_audio: Option<bool>,
    pub system_audio: Option<bool>,
    pub fps: Option<u32>,
    pub display_id: Option<i32>,
    pub bounds: Option<Rectangle>,
}

// Fast capture for recording (JPEG instead of PNG)
// fps: target frame rate (adjusts quality/resolution automatically)
// bounds: optional region to capture (if None, captures full screen)
pub fn capture_screen_fast(display_id: Option<i32>, fps: u32, bounds: Option<Rectangle>) -> Result<Vec<u8>, String> {
    #[cfg(target_os = "macos")]
    {
        use core_graphics::display::{CGDisplay, CGMainDisplayID};

        let display = if let Some(id) = display_id {
            CGDisplay::new(id as u32)
        } else {
            unsafe { CGDisplay::new(CGMainDisplayID()) }
        };

        let image = display.image()
            .ok_or_else(|| "Failed to capture screen".to_string())?;

        let full_width = image.width() as u32;
        let full_height = image.height() as u32;
        let bytes_per_row = image.bytes_per_row();
        let data = image.data();

        // Calculate scale factor (physical pixels / logical pixels) for HiDPI displays
        let logical_width = display.pixels_wide() as f64;
        let logical_height = display.pixels_high() as f64;
        let scale_x = full_width as f64 / logical_width;
        let scale_y = full_height as f64 / logical_height;

        if bounds.is_some() {
            println!("[Capture] Scale factor: {}x (logical: {}x{}, physical: {}x{})",
                     scale_x, logical_width, logical_height, full_width, full_height);
        }

        // Determine capture region (full screen or bounded region)
        let (region_x, region_y, width, height) = if let Some(rect) = bounds {
            // Scale logical bounds to physical pixels for HiDPI displays
            let x = ((rect.x as f64 * scale_x).max(0.0) as u32);
            let y = ((rect.y as f64 * scale_y).max(0.0) as u32);
            let w = ((rect.width as f64 * scale_x) as u32).min(full_width - x);
            let h = ((rect.height as f64 * scale_y) as u32).min(full_height - y);
            println!("[Capture] Logical bounds: ({}, {}) {}x{} → Physical: ({}, {}) {}x{}",
                     rect.x, rect.y, rect.width, rect.height, x, y, w, h);
            (x, y, w, h)
        } else {
            (0, 0, full_width, full_height)
        };

        // Auto-adjust resolution based on target FPS for optimal quality/speed balance
        let sample_rate = if fps == 35 {
            1 // 100% resolution - Max Quality mode (fps=35 is special marker)
        } else if fps <= 10 {
            2 // 50% resolution - good for 5-10fps
        } else if fps <= 20 {
            1 // 100% resolution - for 15-20fps (fast machines)
        } else if fps <= 30 {
            1 // 100% resolution - for 30fps (very fast machines)
        } else {
            3 // 33% resolution - for 60fps (need MUCH faster capture!)
        };
        let mut scaled_width = width / sample_rate;
        let mut scaled_height = height / sample_rate;

        // H.264 requires even dimensions - force even by rounding down
        if scaled_width % 2 != 0 { scaled_width -= 1; }
        if scaled_height % 2 != 0 { scaled_height -= 1; }

        // Convert to RGB and downsample in one pass
        use image::{ImageBuffer, Rgb, RgbImage};
        let mut scaled_buffer: RgbImage = ImageBuffer::new(scaled_width, scaled_height);

        for y in 0..scaled_height {
            for x in 0..scaled_width {
                // Sample from region with offset
                let src_x = region_x + (x * sample_rate);
                let src_y = region_y + (y * sample_rate);
                let offset = (src_y as usize * bytes_per_row as usize) + (src_x as usize * 4);

                if offset + 3 < data.len() as usize {
                    let b = data[offset];
                    let g = data[offset + 1];
                    let r = data[offset + 2];
                    // Skip alpha channel for JPEG
                    scaled_buffer.put_pixel(x, y, Rgb([r, g, b]));
                }
            }
        }

        // Adjust JPEG quality based on target FPS
        let jpeg_quality = if fps == 35 {
            95 // Maximum quality for Max Quality mode (fps=35 is special marker)
        } else if fps >= 60 {
            75 // Lower quality for speed (60fps needs FAST encoding)
        } else if fps >= 30 {
            85 // Good quality for 30fps
        } else {
            90 // High quality for lower FPS
        };

        let mut output = Vec::new();
        let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut output, jpeg_quality);
        encoder.encode(
            &scaled_buffer,
            scaled_width,
            scaled_height,
            image::ColorType::Rgb8.into(),
        ).map_err(|e: image::ImageError| e.to_string())?;

        return Ok(output);
    }

    #[cfg(not(target_os = "macos"))]
    return Err("Platform not supported".to_string());
}

// Internal helper for recording (not exposed as command)
pub fn capture_screen_internal(display_id: Option<i32>) -> Result<Vec<u8>, String> {
    #[cfg(target_os = "macos")]
    {
        use core_graphics::display::{CGDisplay, CGMainDisplayID};
        use image::{ImageBuffer, Rgba, RgbaImage, ImageEncoder};

        let display = if let Some(id) = display_id {
            CGDisplay::new(id as u32)
        } else {
            unsafe { CGDisplay::new(CGMainDisplayID()) }
        };

        let image = display.image()
            .ok_or_else(|| "Failed to capture screen".to_string())?;

        let width = image.width() as u32;
        let height = image.height() as u32;
        let bytes_per_row = image.bytes_per_row();
        let data = image.data();

        let mut rgba_buffer: RgbaImage = ImageBuffer::new(width, height);

        for y in 0..height {
            for x in 0..width {
                let offset = (y as usize * bytes_per_row as usize) + (x as usize * 4);
                if offset + 3 < data.len() as usize {
                    let b = data[offset];
                    let g = data[offset + 1];
                    let r = data[offset + 2];
                    let a = data[offset + 3];
                    rgba_buffer.put_pixel(x, y, Rgba([r, g, b, a]));
                }
            }
        }

        let mut output = Vec::new();
        let encoder = image::codecs::png::PngEncoder::new(&mut output);
        encoder.write_image(
            &rgba_buffer,
            width,
            height,
            image::ColorType::Rgba8.into(),
        ).map_err(|e: image::ImageError| e.to_string())?;

        return Ok(output);
    }

    #[cfg(not(target_os = "macos"))]
    return Err("Platform not supported".to_string());
}

#[tauri::command]
pub async fn capture_screen(options: CaptureOptions) -> Result<Vec<u8>, String> {
    #[cfg(target_os = "macos")]
    {
        use core_graphics::display::{CGDisplay, CGMainDisplayID};
        use image::{ImageBuffer, Rgba, RgbaImage, ImageEncoder};

        // Get the display (use specified display_id or default to main display)
        let display = if let Some(display_id) = options.display_id {
            CGDisplay::new(display_id as u32)
        } else {
            unsafe { CGDisplay::new(CGMainDisplayID()) }
        };

        // Capture the screen
        let image = display.image()
            .ok_or_else(|| "Failed to capture screen".to_string())?;

        let width = image.width() as u32;
        let height = image.height() as u32;
        let bytes_per_row = image.bytes_per_row();
        let data = image.data();

        // Convert CGImage data to RGBA
        let mut rgba_buffer: RgbaImage = ImageBuffer::new(width, height);

        for y in 0..height {
            for x in 0..width {
                let offset = (y as usize * bytes_per_row as usize) + (x as usize * 4);
                if offset + 3 < data.len() as usize {
                    // CGImage is BGRA, convert to RGBA
                    let b = data[offset];
                    let g = data[offset + 1];
                    let r = data[offset + 2];
                    let a = data[offset + 3];
                    rgba_buffer.put_pixel(x, y, Rgba([r, g, b, a]));
                }
            }
        }

        // Apply resolution scaling if requested (for faster encoding)
        let (final_buffer, final_width, final_height) = if let Some(scale) = options.scale {
            if scale > 0.0 && scale < 1.0 {
                let scaled_width = (width as f32 * scale) as u32;
                let scaled_height = (height as f32 * scale) as u32;
                let sample_rate = (1.0 / scale) as u32;

                println!("[Capture] Downsampling {}x{} → {}x{} (scale: {})",
                         width, height, scaled_width, scaled_height, scale);

                let mut scaled_buffer: RgbaImage = ImageBuffer::new(scaled_width, scaled_height);
                for y in 0..scaled_height {
                    for x in 0..scaled_width {
                        let src_x = (x * sample_rate).min(width - 1);
                        let src_y = (y * sample_rate).min(height - 1);
                        let pixel = rgba_buffer.get_pixel(src_x, src_y);
                        scaled_buffer.put_pixel(x, y, *pixel);
                    }
                }
                (scaled_buffer, scaled_width, scaled_height)
            } else {
                (rgba_buffer, width, height)
            }
        } else {
            (rgba_buffer, width, height)
        };

        // Encode to PNG or JPEG based on format option
        let mut output = Vec::new();
        let format = options.format.as_deref().unwrap_or("png");

        match format {
            "jpg" | "jpeg" => {
                // JPEG doesn't support alpha - convert RGBA to RGB
                use image::{RgbImage, Rgb};
                let mut rgb_buffer: RgbImage = ImageBuffer::new(final_width, final_height);
                for y in 0..final_height {
                    for x in 0..final_width {
                        let rgba = final_buffer.get_pixel(x, y);
                        rgb_buffer.put_pixel(x, y, Rgb([rgba[0], rgba[1], rgba[2]]));
                    }
                }

                let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(
                    &mut output,
                    (options.quality.unwrap_or(0.92) * 100.0) as u8,
                );
                encoder.encode(
                    &rgb_buffer,
                    final_width,
                    final_height,
                    image::ColorType::Rgb8.into(),
                ).map_err(|e: image::ImageError| e.to_string())?;
            }
            _ => {
                // Default to PNG
                let encoder = image::codecs::png::PngEncoder::new(&mut output);
                encoder.write_image(
                    &final_buffer,
                    final_width,
                    final_height,
                    image::ColorType::Rgba8.into(),
                ).map_err(|e: image::ImageError| e.to_string())?;
            }
        }

        return Ok(output);
    }

    #[cfg(target_os = "windows")]
    return Err("Windows capture not yet implemented".to_string());

    #[cfg(target_os = "linux")]
    return Err("Linux capture not yet implemented".to_string());

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    return Err("Unsupported platform".to_string());
}

#[tauri::command]
pub async fn list_displays() -> Result<Vec<DisplayInfo>, String> {
    #[cfg(target_os = "macos")]
    {
        use core_graphics::display::{CGDisplay, CGMainDisplayID, CGGetActiveDisplayList};

        // Get all active displays
        let max_displays = 32;
        let mut displays = vec![0u32; max_displays];
        let mut display_count = 0u32;

        unsafe {
            CGGetActiveDisplayList(max_displays as u32, displays.as_mut_ptr(), &mut display_count);
        }

        let main_display_id = unsafe { CGMainDisplayID() };
        let mut result = Vec::new();

        for i in 0..display_count as usize {
            let display_id = displays[i];
            let display = CGDisplay::new(display_id);

            result.push(DisplayInfo {
                id: display_id as i32,
                name: format!("Display {}", i + 1),
                width: display.pixels_wide() as u32,
                height: display.pixels_high() as u32,
                is_main: display_id == main_display_id,
            });
        }

        return Ok(result);
    }

    #[cfg(target_os = "windows")]
    return Err("Windows display enumeration not yet implemented".to_string());

    #[cfg(target_os = "linux")]
    return Err("Linux display enumeration not yet implemented".to_string());

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    return Err("Unsupported platform".to_string());
}

#[tauri::command]
pub async fn capture_window(_window_id: Option<String>) -> Result<Vec<u8>, String> {
    Err("Window capture not yet implemented".to_string())
}

#[tauri::command]
pub async fn capture_region(bounds: Rectangle, display_id: Option<i32>) -> Result<Vec<u8>, String> {
    // Use high quality settings for single-frame region capture from specified display
    capture_screen_fast(display_id, 10, Some(bounds))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegionSelectorOptions {
    pub display_id: Option<i32>,
}

#[tauri::command]
pub async fn show_region_selector(app: tauri::AppHandle, options: Option<RegionSelectorOptions>) -> Result<(), String> {
    let display_id = options.and_then(|o| o.display_id);
    println!("[Command] show_region_selector called with display_id: {:?}", display_id);
    crate::overlay::show_region_selector(&app, display_id)
}

#[tauri::command]
pub async fn close_region_selector(app: tauri::AppHandle) -> Result<(), String> {
    crate::overlay::close_region_selector(&app)
}

#[tauri::command]
pub async fn submit_region_selection(
    app: tauri::AppHandle,
    bounds: Rectangle,
) -> Result<(), String> {
    // Emit event with selected region to main window
    app.emit("region-selected", bounds)
        .map_err(|e: tauri::Error| e.to_string())?;

    // Close the overlay
    crate::overlay::close_region_selector(&app)
}

#[tauri::command]
pub async fn start_recording(options: RecordOptions) -> Result<crate::recording::RecordingHandle, String> {
    // Convert to recording module options
    let record_opts = crate::recording::RecordOptions {
        format: options.format,
        fps: options.fps,
        display_id: options.display_id,
        include_audio: options.include_audio,
        system_audio: options.system_audio,
        bounds: options.bounds,
    };

    crate::recording::start_recording(record_opts)
}

#[tauri::command]
pub async fn stop_recording(handle_id: String) -> Result<Vec<u8>, String> {
    crate::recording::stop_recording(handle_id)
}

#[tauri::command]
pub async fn check_screen_recording_permission() -> Result<bool, String> {
    // Check if app has screen recording permission (macOS specific)
    #[cfg(target_os = "macos")]
    {
        // Will implement with CoreGraphics API
        Ok(true) // Placeholder
    }

    #[cfg(not(target_os = "macos"))]
    Ok(true)
}

#[tauri::command]
pub async fn hide_main_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        // Use minimize instead of hide so user can restore from dock
        window.minimize().map_err(|e: tauri::Error| e.to_string())?;
        println!("[Window] Main window minimized");
    }
    Ok(())
}

#[tauri::command]
pub async fn show_main_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        // Unminimize and show the window
        window.unminimize().map_err(|e: tauri::Error| e.to_string())?;
        window.show().map_err(|e: tauri::Error| e.to_string())?;
        window.set_focus().map_err(|e: tauri::Error| e.to_string())?;
        println!("[Window] Main window restored and focused");
    }
    Ok(())
}

#[tauri::command]
pub async fn show_countdown(app: tauri::AppHandle, display_id: Option<i32>) -> Result<(), String> {
    crate::overlay::show_countdown(&app, display_id)
}

#[tauri::command]
pub async fn close_countdown(app: tauri::AppHandle) -> Result<(), String> {
    crate::overlay::close_countdown(&app)
}
