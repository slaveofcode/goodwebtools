// src-tauri/src/overlay.rs
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, WebviewUrl, WebviewWindowBuilder};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Rectangle {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// Pre-create the region-selector overlay window, hidden, at app startup.
///
/// Building a WebviewWindow pays a large one-time WebView init penalty
/// (WebKit on macOS, WebView2 on Windows). Doing it up front — instead of on
/// the shortcut hot path — is what makes later shows feel instant.
pub fn prewarm_region_selector(app: &AppHandle) -> Result<(), String> {
    if app.get_webview_window("region-selector").is_some() {
        return Ok(()); // already warmed
    }

    let builder = WebviewWindowBuilder::new(
        app,
        "region-selector",
        WebviewUrl::App("/overlay".into()),
    )
    .title("Select Region")
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .visible(false);

    // On macOS the window is repositioned/resized per display on show; give it a
    // sane placeholder size. On other platforms fullscreen covers all displays.
    #[cfg(target_os = "macos")]
    let builder = builder.inner_size(1280.0, 800.0);
    #[cfg(not(target_os = "macos"))]
    let builder = builder.fullscreen(true);

    builder
        .build()
        .map_err(|e: tauri::Error| e.to_string())?;

    println!("[Overlay] Pre-warmed region-selector window");
    Ok(())
}

/// Show transparent fullscreen overlay for region selection on specified display.
///
/// Reuses the pre-warmed window when available (fast path): reposition to the
/// target display, show, and emit `overlay-show` so the already-loaded page
/// re-initializes for this capture. Falls back to building on the fly.
pub fn show_region_selector(app: &AppHandle, display_id: Option<i32>) -> Result<(), String> {
    // Fast path: reuse the pre-warmed window.
    if let Some(window) = app.get_webview_window("region-selector") {
        #[cfg(target_os = "macos")]
        {
            use core_graphics::display::{CGDisplay, CGMainDisplayID};

            let target_display_id = display_id
                .map(|id| id as u32)
                .unwrap_or_else(|| unsafe { CGMainDisplayID() });
            let bounds = CGDisplay::new(target_display_id).bounds();

            println!(
                "[Overlay] Reusing window on display {:?}: ({}, {}) {}x{}",
                target_display_id,
                bounds.origin.x, bounds.origin.y,
                bounds.size.width, bounds.size.height
            );

            // Reposition + resize every show to avoid the "wrong display" reuse bug.
            window
                .set_position(LogicalPosition::new(bounds.origin.x, bounds.origin.y))
                .map_err(|e: tauri::Error| e.to_string())?;
            window
                .set_size(LogicalSize::new(bounds.size.width, bounds.size.height))
                .map_err(|e: tauri::Error| e.to_string())?;
        }

        window.show().map_err(|e: tauri::Error| e.to_string())?;
        let _ = window.set_focus();

        // The overlay page's script only runs once at load; nudge it to
        // re-initialize (reset selection, reload background) for this show.
        let _ = window.emit("overlay-show", display_id);

        return Ok(());
    }

    // Fallback: no pre-warmed window — build one on the fly.
    #[cfg(target_os = "macos")]
    {
        use core_graphics::display::{CGDisplay, CGMainDisplayID};

        let target_display_id = display_id
            .map(|id| id as u32)
            .unwrap_or_else(|| unsafe { CGMainDisplayID() });
        let bounds = CGDisplay::new(target_display_id).bounds();

        println!("[Overlay] Building window on display {:?}: ({}, {}) {}x{}",
                 target_display_id, bounds.origin.x, bounds.origin.y,
                 bounds.size.width, bounds.size.height);

        let window = WebviewWindowBuilder::new(
            app,
            "region-selector",
            WebviewUrl::App("/overlay".into())
        )
        .title("Select Region")
        .position(bounds.origin.x, bounds.origin.y)
        .inner_size(bounds.size.width, bounds.size.height)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .build()
        .map_err(|e: tauri::Error| e.to_string())?;

        window.show().map_err(|e: tauri::Error| e.to_string())?;
        return Ok(());
    }

    #[cfg(not(target_os = "macos"))]
    {
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

        window.show().map_err(|e: tauri::Error| e.to_string())?;
        return Ok(());
    }
}

/// Hide the region selector overlay, keeping the window warm for reuse.
pub fn close_region_selector(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("region-selector") {
        window.hide().map_err(|e: tauri::Error| e.to_string())?;
    }
    Ok(())
}

/// Show countdown overlay on specific display
pub fn show_countdown(app: &AppHandle, display_id: Option<i32>) -> Result<(), String> {
    // Close any existing countdown
    let _ = close_countdown(app);

    #[cfg(target_os = "macos")]
    {
        use core_graphics::display::{CGDisplay, CGMainDisplayID};

        // Get the target display
        let target_display_id = display_id
            .map(|id| id as u32)
            .unwrap_or_else(|| unsafe { CGMainDisplayID() });
        let display = CGDisplay::new(target_display_id);

        // Get display bounds and center countdown on that display
        let bounds = display.bounds();
        let x = bounds.origin.x + (bounds.size.width / 2.0) - 200.0; // Center 400px wide window
        let y = bounds.origin.y + (bounds.size.height / 2.0) - 200.0; // Center 400px tall window

        println!("[Countdown] Display ID: {:?}, Position: ({}, {})", target_display_id, x, y);

        // Create countdown window on specific display
        let window = WebviewWindowBuilder::new(
            app,
            "countdown",
            WebviewUrl::App("/countdown".into())
        )
        .title("Recording Countdown")
        .position(x, y)
        .inner_size(400.0, 400.0)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .build()
        .map_err(|e: tauri::Error| e.to_string())?;

        window.show().map_err(|e: tauri::Error| e.to_string())?;

        return Ok(());
    }

    #[cfg(not(target_os = "macos"))]
    {
        // Fallback: centered on main display
        let window = WebviewWindowBuilder::new(
            app,
            "countdown",
            WebviewUrl::App("/countdown".into())
        )
        .title("Recording Countdown")
        .inner_size(400.0, 400.0)
        .center()
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .build()
        .map_err(|e: tauri::Error| e.to_string())?;

        window.show().map_err(|e: tauri::Error| e.to_string())?;

        return Ok(());
    }
}

/// Close the countdown overlay
pub fn close_countdown(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("countdown") {
        window.close().map_err(|e: tauri::Error| e.to_string())?;
    }
    Ok(())
}

/// Show screen selector window for multi-display selection
pub fn show_screen_selector(app: &AppHandle) -> Result<(), String> {
    // Close any existing screen selector window first
    let _ = close_screen_selector(app);

    println!("[ScreenSelector] Opening screen selector window");

    // Create centered window for screen selection
    let window = WebviewWindowBuilder::new(
        app,
        "screen-selector",
        WebviewUrl::App("/screen-selector".into())
    )
    .title("Select Screen to Capture")
    .center()
    .inner_size(1200.0, 700.0)
    .resizable(false)
    .always_on_top(true)
    .visible(false)
    .build()
    .map_err(|e: tauri::Error| e.to_string())?;

    window.show().map_err(|e: tauri::Error| e.to_string())?;

    Ok(())
}

/// Close the screen selector window
pub fn close_screen_selector(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("screen-selector") {
        window.close().map_err(|e: tauri::Error| e.to_string())?;
    }
    Ok(())
}
