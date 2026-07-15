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

/// Show transparent fullscreen overlay for region selection
pub fn show_region_selector(app: &AppHandle) -> Result<(), String> {
    // Create a transparent fullscreen window
    let window = WebviewWindowBuilder::new(
        app,
        "region-selector",
        WebviewUrl::App("/overlay".into())
    )
    .title("Select Region")
    .fullscreen(true)
    .transparent(true)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .visible(false) // Start hidden, show after load
    .build()
    .map_err(|e| e.to_string())?;

    // Show window after it's ready
    window.show().map_err(|e| e.to_string())?;

    Ok(())
}

/// Close the region selector overlay
pub fn close_region_selector(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("region-selector") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}
