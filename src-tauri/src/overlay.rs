// src-tauri/src/overlay.rs
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Rectangle {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// Show transparent fullscreen overlay for region selection on specified display
pub fn show_region_selector(app: &AppHandle, display_id: Option<u32>) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use core_graphics::display::{CGDisplay, CGMainDisplayID};

        // Get the target display
        let target_display_id = display_id.unwrap_or_else(|| unsafe { CGMainDisplayID() });
        let display = CGDisplay::new(target_display_id);

        // Get display bounds
        let bounds = display.bounds();
        let x = bounds.origin.x as i32;
        let y = bounds.origin.y as i32;
        let width = bounds.size.width as f64;
        let height = bounds.size.height as f64;

        println!("[Overlay] Display ID: {:?}, Bounds: ({}, {}) {}x{}",
                 target_display_id, x, y, width, height);

        // Create window positioned on the specific display
        let window = WebviewWindowBuilder::new(
            app,
            "region-selector",
            WebviewUrl::App("/overlay".into())
        )
        .title("Select Region")
        .position(x as f64, y as f64)
        .inner_size(width, height)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .build()
        .map_err(|e: tauri::Error| e.to_string())?;

        // Show window after it's ready
        window.show().map_err(|e: tauri::Error| e.to_string())?;

        return Ok(());
    }

    #[cfg(not(target_os = "macos"))]
    {
        // Fallback for non-macOS: just use fullscreen
        let window = WebviewWindowBuilder::new(
            app,
            "region-selector",
            WebviewUrl::App("/overlay".into())
        )
        .title("Select Region")
        .fullscreen(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .build()
        .map_err(|e: tauri::Error| e.to_string())?;

        // Show window after it's ready
        window.show().map_err(|e: tauri::Error| e.to_string())?;

        return Ok(());
    }
}

/// Close the region selector overlay
pub fn close_region_selector(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("region-selector") {
        window.close().map_err(|e: tauri::Error| e.to_string())?;
    }
    Ok(())
}
