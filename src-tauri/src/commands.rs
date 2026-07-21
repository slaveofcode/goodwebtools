// src-tauri/src/commands.rs
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
// include_audio/system_audio are part of the frontend wire contract but only
// used by the recording path, not by still capture — keep them, don't warn.
#[allow(dead_code)]
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
    #[serde(rename = "displayId")]
    pub display_id: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
// video_bitrate/audio_bitrate are accepted from the frontend but not yet
// threaded into the encoder — reserved config, keep without warning.
#[allow(dead_code)]
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
            let x = (rect.x as f64 * scale_x).max(0.0) as u32;
            let y = (rect.y as f64 * scale_y).max(0.0) as u32;
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

    #[cfg(any(target_os = "windows", target_os = "linux"))]
    {
        let (full, logical_w, logical_h) = xcap_capture(display_id)?;

        // Crop to the requested region (logical → physical) if any.
        let cropped = if let Some(rect) = bounds {
            crop_rgba(&full, &rect, logical_w, logical_h)
        } else {
            full
        };

        // Match the macOS sample-rate / quality tiers by target FPS.
        let sample_rate: u32 = if fps == 35 {
            1
        } else if fps <= 10 {
            2
        } else if fps <= 30 {
            1
        } else {
            3
        };
        let mut w = (cropped.width() / sample_rate).max(2);
        let mut h = (cropped.height() / sample_rate).max(2);
        if w % 2 != 0 { w -= 1; }
        if h % 2 != 0 { h -= 1; }

        let resized = if w != cropped.width() || h != cropped.height() {
            image::imageops::resize(&cropped, w, h, image::imageops::FilterType::Triangle)
        } else {
            cropped
        };

        let rgb = image::DynamicImage::ImageRgba8(resized).to_rgb8();
        let jpeg_quality = if fps == 35 {
            95
        } else if fps >= 60 {
            75
        } else if fps >= 30 {
            85
        } else {
            90
        };

        let mut output = Vec::new();
        let mut encoder =
            image::codecs::jpeg::JpegEncoder::new_with_quality(&mut output, jpeg_quality);
        encoder
            .encode(&rgb, rgb.width(), rgb.height(), image::ColorType::Rgb8.into())
            .map_err(|e: image::ImageError| e.to_string())?;
        return Ok(output);
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    return Err("Platform not supported".to_string());
}

// Internal helper for recording (not exposed as command).
// Kept as a reference PNG-capture path; recording uses capture_screen_fast.
#[allow(dead_code)]
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
pub async fn capture_screen(options: CaptureOptions) -> Result<tauri::ipc::Response, String> {
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

        // Return raw bytes over IPC (not a JSON number[]) — much faster + smaller.
        return Ok(tauri::ipc::Response::new(output));
    }

    #[cfg(any(target_os = "windows", target_os = "linux"))]
    {
        use image::ImageEncoder;

        let (mut img, _lw, _lh) = xcap_capture(options.display_id)?;

        // Optional resolution downscale (e.g. 0.5 for a faster overlay background)
        if let Some(scale) = options.scale {
            if scale > 0.0 && scale < 1.0 {
                let nw = ((img.width() as f32) * scale).round().max(1.0) as u32;
                let nh = ((img.height() as f32) * scale).round().max(1.0) as u32;
                img = image::imageops::resize(&img, nw, nh, image::imageops::FilterType::Triangle);
            }
        }

        let format = options.format.as_deref().unwrap_or("png");
        let mut output = Vec::new();
        match format {
            "jpg" | "jpeg" => {
                let rgb = image::DynamicImage::ImageRgba8(img).to_rgb8();
                let q = (options.quality.unwrap_or(0.92) * 100.0) as u8;
                let mut encoder =
                    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut output, q);
                encoder
                    .encode(&rgb, rgb.width(), rgb.height(), image::ColorType::Rgb8.into())
                    .map_err(|e: image::ImageError| e.to_string())?;
            }
            _ => {
                image::codecs::png::PngEncoder::new(&mut output)
                    .write_image(&img, img.width(), img.height(), image::ColorType::Rgba8.into())
                    .map_err(|e: image::ImageError| e.to_string())?;
            }
        }
        return Ok(tauri::ipc::Response::new(output));
    }

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

    #[cfg(any(target_os = "windows", target_os = "linux"))]
    {
        let monitors = xcap::Monitor::all().map_err(|e| e.to_string())?;
        let mut result = Vec::new();
        for (i, m) in monitors.iter().enumerate() {
            let scale = m.scale_factor().unwrap_or(1.0).max(1.0);
            let phys_w = m.width().unwrap_or(0);
            let phys_h = m.height().unwrap_or(0);
            result.push(DisplayInfo {
                id: m.id().map(|v| v as i32).unwrap_or(i as i32),
                name: m
                    .friendly_name()
                    .or_else(|_| m.name())
                    .unwrap_or_else(|_| format!("Display {}", i + 1)),
                // Report logical dimensions (physical / scale) to match macOS,
                // so the frontend's logical region coords scale correctly.
                width: ((phys_w as f32) / scale).round() as u32,
                height: ((phys_h as f32) / scale).round() as u32,
                is_main: m.is_primary().unwrap_or(false),
            });
        }
        return Ok(result);
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    return Err("Unsupported platform".to_string());
}

#[tauri::command]
pub async fn capture_window(_window_id: Option<String>) -> Result<tauri::ipc::Response, String> {
    Err("Window capture not yet implemented".to_string())
}

#[tauri::command]
pub async fn capture_region(bounds: Rectangle, display_id: Option<i32>) -> Result<tauri::ipc::Response, String> {
    // Use displayId from bounds if available, otherwise use parameter
    let target_display = bounds.display_id.or(display_id);
    println!("[Capture] Region capture - displayId from bounds: {:?}, from param: {:?}, using: {:?}",
             bounds.display_id, display_id, target_display);

    // Use high quality settings for single-frame region capture from specified display.
    // Return raw bytes over IPC (not a JSON number[]).
    capture_screen_fast(target_display, 10, Some(bounds)).map(tauri::ipc::Response::new)
}

// ── Held full-res captures for native region cropping (Phase D) ──────────────
// The in-tool region flow captures the frozen full screen once (while the main
// window is hidden), holds it in Rust, and crops server-side after the user
// selects — so only the small crop crosses IPC, never the whole screen.

// The held frame is stored as an RGBA image so cropping is one platform-agnostic
// path (macOS core-graphics and Windows/Linux xcap both feed into it).
struct HeldCapture {
    image: image::RgbaImage, // physical pixels, RGBA
    logical_width: u32,
    logical_height: u32,
}

lazy_static::lazy_static! {
    static ref HELD_CAPTURES: std::sync::Mutex<std::collections::HashMap<String, HeldCapture>> =
        std::sync::Mutex::new(std::collections::HashMap::new());
}

static CAPTURE_SEQ: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

/// Map a logical-pixel selection rect to a clamped physical-pixel crop rect,
/// applying the display's HiDPI scale. Pure — unit-tested.
fn physical_crop_rect(
    region: &Rectangle,
    phys_w: u32,
    phys_h: u32,
    logical_w: u32,
    logical_h: u32,
) -> (u32, u32, u32, u32) {
    if logical_w == 0 || logical_h == 0 || phys_w == 0 || phys_h == 0 {
        return (0, 0, phys_w.max(1), phys_h.max(1));
    }
    let scale_x = phys_w as f64 / logical_w as f64;
    let scale_y = phys_h as f64 / logical_h as f64;
    let x = ((region.x as f64 * scale_x).max(0.0) as u32).min(phys_w.saturating_sub(1));
    let y = ((region.y as f64 * scale_y).max(0.0) as u32).min(phys_h.saturating_sub(1));
    let w = ((region.width as f64 * scale_x).round() as u32).clamp(1, phys_w - x);
    let h = ((region.height as f64 * scale_y).round() as u32).clamp(1, phys_h - y);
    (x, y, w, h)
}

/// Crop a physical RGBA frame to a logical selection rect. Pure — unit-tested.
pub(crate) fn crop_rgba(
    img: &image::RgbaImage,
    region: &Rectangle,
    logical_w: u32,
    logical_h: u32,
) -> image::RgbaImage {
    let (x, y, w, h) = physical_crop_rect(region, img.width(), img.height(), logical_w, logical_h);
    image::imageops::crop_imm(img, x, y, w, h).to_image()
}

fn store_held(held: HeldCapture) -> Result<String, String> {
    let id = format!(
        "cap_{}",
        CAPTURE_SEQ.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
    );
    let mut map = HELD_CAPTURES.lock().map_err(|e| e.to_string())?;
    map.clear(); // only one region capture is active at a time — bound memory
    map.insert(id.clone(), held);
    Ok(id)
}

/// xcap-backed full capture for Windows/Linux. Returns (physical RGBA, logical w, logical h).
#[cfg(any(target_os = "windows", target_os = "linux"))]
fn xcap_capture(display_id: Option<i32>) -> Result<(image::RgbaImage, u32, u32), String> {
    let monitors = xcap::Monitor::all().map_err(|e| e.to_string())?;
    let monitor = match display_id {
        Some(id) => monitors
            .into_iter()
            .find(|m| m.id().map(|v| v as i32 == id).unwrap_or(false))
            .ok_or_else(|| format!("Display {} not found", id))?,
        None => monitors
            .into_iter()
            .find(|m| m.is_primary().unwrap_or(false))
            .ok_or_else(|| "No primary monitor found".to_string())?,
    };
    let scale = monitor.scale_factor().unwrap_or(1.0).max(1.0);
    let img = monitor.capture_image().map_err(|e| e.to_string())?;
    let logical_w = ((img.width() as f32) / scale).round() as u32;
    let logical_h = ((img.height() as f32) / scale).round() as u32;
    Ok((img, logical_w.max(1), logical_h.max(1)))
}

/// Capture the full display and hold it in memory; returns an id for cropping.
#[tauri::command]
pub async fn capture_hold(display_id: Option<i32>) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        use core_graphics::display::{CGDisplay, CGMainDisplayID};
        use image::{ImageBuffer, Rgba, RgbaImage};

        let display = if let Some(id) = display_id {
            CGDisplay::new(id as u32)
        } else {
            unsafe { CGDisplay::new(CGMainDisplayID()) }
        };
        let cg = display
            .image()
            .ok_or_else(|| "Failed to capture screen".to_string())?;

        let phys_w = cg.width() as u32;
        let phys_h = cg.height() as u32;
        let bytes_per_row = cg.bytes_per_row();
        let data = cg.data();

        let mut buf: RgbaImage = ImageBuffer::new(phys_w, phys_h);
        for y in 0..phys_h {
            for x in 0..phys_w {
                let offset = (y as usize * bytes_per_row) + (x as usize * 4); // BGRA
                if offset + 3 < data.len() as usize {
                    let b = data[offset];
                    let g = data[offset + 1];
                    let r = data[offset + 2];
                    let a = data[offset + 3];
                    buf.put_pixel(x, y, Rgba([r, g, b, a]));
                }
            }
        }

        let id = store_held(HeldCapture {
            image: buf,
            logical_width: display.pixels_wide() as u32,
            logical_height: display.pixels_high() as u32,
        })?;
        println!("[Capture] Held full-res frame {} ({}x{})", id, phys_w, phys_h);
        return Ok(id);
    }

    #[cfg(any(target_os = "windows", target_os = "linux"))]
    {
        let (img, logical_w, logical_h) = xcap_capture(display_id)?;
        let (pw, ph) = (img.width(), img.height());
        let id = store_held(HeldCapture { image: img, logical_width: logical_w, logical_height: logical_h })?;
        println!("[Capture] Held full-res frame {} ({}x{})", id, pw, ph);
        return Ok(id);
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        let _ = display_id;
        return Err("Platform not supported".to_string());
    }
}

/// Crop a previously-held capture to the selected region and return PNG bytes.
/// One-shot: the held frame is dropped after cropping.
#[tauri::command]
pub async fn crop_held(capture_id: String, region: Rectangle) -> Result<tauri::ipc::Response, String> {
    use image::ImageEncoder;

    let held = {
        let mut map = HELD_CAPTURES.lock().map_err(|e| e.to_string())?;
        map.remove(&capture_id)
            .ok_or_else(|| "Held capture not found (already used or expired)".to_string())?
    };

    let cropped = crop_rgba(&held.image, &region, held.logical_width, held.logical_height);

    let mut png = Vec::new();
    image::codecs::png::PngEncoder::new(&mut png)
        .write_image(&cropped, cropped.width(), cropped.height(), image::ColorType::Rgba8.into())
        .map_err(|e: image::ImageError| e.to_string())?;

    println!("[Capture] Cropped held frame → {}x{} ({} bytes)", cropped.width(), cropped.height(), png.len());
    Ok(tauri::ipc::Response::new(png))
}

/// Free a held capture without cropping (e.g. the user cancelled selection).
#[tauri::command]
pub async fn release_held(capture_id: String) -> Result<(), String> {
    if let Ok(mut map) = HELD_CAPTURES.lock() {
        map.remove(&capture_id);
    }
    Ok(())
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

    // Hide the overlay silently — selection already sent, so do NOT emit
    // region-selector-closed (which would resolve the waiter to null).
    crate::overlay::hide_region_selector(&app)
}

#[tauri::command]
pub async fn show_screen_selector(app: tauri::AppHandle) -> Result<(), String> {
    crate::overlay::show_screen_selector(&app)
}

#[tauri::command]
pub async fn close_screen_selector(app: tauri::AppHandle) -> Result<(), String> {
    crate::overlay::close_screen_selector(&app)
}

#[tauri::command]
pub async fn select_display(app: tauri::AppHandle, display_id: i32) -> Result<(), String> {
    println!("[Command] Display selected: {}", display_id);

    // Close screen selector window FIRST
    crate::overlay::close_screen_selector(&app)?;

    // Small delay to ensure window is actually closed
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    // Then emit event to main window to continue workflow
    app.emit("screen-selected", display_id)
        .map_err(|e: tauri::Error| e.to_string())?;

    Ok(())
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
        // hide() removes the window in ~1 frame; minimize() plays a ~250ms
        // macOS genie animation that has to be waited out before capturing.
        // Instant hide is what lets the screenshot flow feel snappy. Used where
        // the window is restored automatically a moment later (screenshots).
        window.hide().map_err(|e: tauri::Error| e.to_string())?;
        println!("[Window] Main window hidden");
    }
    Ok(())
}

/// Minimize (not hide) the main window. Used for recording, where the window
/// stays out of view for the whole session: a minimized window can be brought
/// back from the dock, but a fully-hidden one can't — which locked users out.
#[tauri::command]
pub async fn minimize_main_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionStatus {
    pub screen_recording: bool,
    pub microphone: bool,
    pub ffmpeg_available: bool,
    pub first_run: bool,
}

#[tauri::command]
pub async fn check_permissions() -> Result<PermissionStatus, String> {
    let screen_recording = check_screen_recording_inner();
    let microphone = check_microphone_inner();
    let ffmpeg_available = crate::ffmpeg::is_available();

    // first_run: true if we've never completed the wizard
    let first_run = !std::env::var("GWT_FIRST_RUN_DONE")
        .map(|v| v == "1")
        .unwrap_or(false);

    Ok(PermissionStatus {
        screen_recording,
        microphone,
        ffmpeg_available,
        first_run,
    })
}

#[tauri::command]
pub async fn mark_first_run_complete() -> Result<(), String> {
    // In production this would persist to app config/store.
    // For now set an env var for the current process lifetime.
    std::env::set_var("GWT_FIRST_RUN_DONE", "1");
    Ok(())
}

#[tauri::command]
pub async fn open_system_preferences(section: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let url = match section.as_str() {
            "screen-recording" => "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
            "microphone" => "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone",
            "accessibility" => "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
            _ => "x-apple.systempreferences:",
        };
        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        let _ = section;
        std::process::Command::new("ms-settings:privacy-microphone")
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        let _ = section;
    }
    Ok(())
}

fn check_screen_recording_inner() -> bool {
    // Reuse the existing permission check logic (placeholder returns true on all platforms)
    #[cfg(target_os = "macos")]
    {
        // Try a test capture — if Screen Recording is denied it returns None
        use core_graphics::display::{CGDisplay, CGMainDisplayID};
        let display = unsafe { CGDisplay::new(CGMainDisplayID()) };
        display.image().is_some()
    }
    #[cfg(not(target_os = "macos"))]
    {
        true
    }
}

fn check_microphone_inner() -> bool {
    // Quick non-blocking check: try listing audio devices via ffmpeg
    #[cfg(target_os = "macos")]
    let format = "avfoundation";
    #[cfg(target_os = "windows")]
    let format = "dshow";
    #[cfg(target_os = "linux")]
    let format = "pulse";
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    let format = "null";

    std::process::Command::new(crate::ffmpeg::ffmpeg_path())
        .args(["-f", format, "-list_devices", "true", "-i", "dummy"])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .is_ok()
}

#[tauri::command]
pub fn get_cursor_position() -> Result<(f64, f64), String> {
    #[cfg(target_os = "macos")]
    {
        use cocoa::foundation::NSPoint;
        use objc::{class, msg_send, sel, sel_impl};

        unsafe {
            // Get current mouse location in screen coordinates
            let mouse_loc: NSPoint = msg_send![class!(NSEvent), mouseLocation];

            // NSEvent::mouseLocation() returns coordinates with origin at bottom-left
            // We need to flip Y coordinate to match CGDisplay coordinates (top-left origin)
            // Get main display height for coordinate conversion
            use core_graphics::display::CGDisplay;
            let main_display = CGDisplay::main();
            let display_height = main_display.pixels_high() as f64;

            // Flip Y coordinate
            let flipped_y = display_height - mouse_loc.y;

            Ok((mouse_loc.x, flipped_y))
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        // TODO: Implement for Windows and Linux
        Err("get_cursor_position not implemented for this platform".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rect(x: i32, y: i32, w: u32, h: u32) -> Rectangle {
        Rectangle { x, y, width: w, height: h, display_id: None }
    }

    #[test]
    fn crop_rect_non_hidpi_is_identity_scale() {
        // logical == physical (scale 1.0)
        let (x, y, w, h) = physical_crop_rect(&rect(10, 20, 100, 50), 1920, 1080, 1920, 1080);
        assert_eq!((x, y, w, h), (10, 20, 100, 50));
    }

    #[test]
    fn crop_rect_scales_for_2x_retina() {
        // physical is 2x logical → coordinates double
        let (x, y, w, h) = physical_crop_rect(&rect(10, 20, 100, 50), 2880, 1800, 1440, 900);
        assert_eq!((x, y, w, h), (20, 40, 200, 100));
    }

    #[test]
    fn crop_rect_clamps_to_physical_bounds() {
        // a region running past the edge is clamped to the frame
        let (x, y, w, h) = physical_crop_rect(&rect(1900, 1000, 500, 500), 1920, 1080, 1920, 1080);
        assert_eq!(x, 1900);
        assert_eq!(y, 1000);
        assert_eq!(w, 20); // 1920 - 1900
        assert_eq!(h, 80); // 1080 - 1000
    }

    #[test]
    fn crop_rect_negative_origin_floored_to_zero() {
        let (x, y, _, _) = physical_crop_rect(&rect(-50, -30, 100, 100), 1920, 1080, 1920, 1080);
        assert_eq!((x, y), (0, 0));
    }

    #[test]
    fn crop_rect_zero_dims_never_produce_empty_crop() {
        // width/height always at least 1 so the PNG encoder never sees 0
        let (_, _, w, h) = physical_crop_rect(&rect(0, 0, 0, 0), 1920, 1080, 1920, 1080);
        assert!(w >= 1 && h >= 1);
    }

    #[test]
    fn crop_rect_zero_logical_falls_back_to_full_frame() {
        let (x, y, w, h) = physical_crop_rect(&rect(10, 10, 100, 100), 1920, 1080, 0, 0);
        assert_eq!((x, y, w, h), (0, 0, 1920, 1080));
    }

    fn gradient(w: u32, h: u32) -> image::RgbaImage {
        // Each pixel encodes its own (x, y) in the R and G channels.
        let mut img = image::RgbaImage::new(w, h);
        for y in 0..h {
            for x in 0..w {
                img.put_pixel(x, y, image::Rgba([x as u8, y as u8, 0, 255]));
            }
        }
        img
    }

    #[test]
    fn crop_rgba_extracts_region_at_scale_1() {
        let img = gradient(4, 4);
        let out = crop_rgba(&img, &rect(1, 1, 2, 2), 4, 4);
        assert_eq!(out.dimensions(), (2, 2));
        assert_eq!(out.get_pixel(0, 0), &image::Rgba([1, 1, 0, 255]));
        assert_eq!(out.get_pixel(1, 1), &image::Rgba([2, 2, 0, 255]));
    }

    #[test]
    fn crop_rgba_scales_logical_region_on_hidpi() {
        // 8x8 physical, 4x4 logical (2x). Logical (1,1,2,2) → physical (2,2,4,4).
        let img = gradient(8, 8);
        let out = crop_rgba(&img, &rect(1, 1, 2, 2), 4, 4);
        assert_eq!(out.dimensions(), (4, 4));
        assert_eq!(out.get_pixel(0, 0), &image::Rgba([2, 2, 0, 255]));
        assert_eq!(out.get_pixel(3, 3), &image::Rgba([5, 5, 0, 255]));
    }
}
