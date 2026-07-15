#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod overlay;
mod recording;
mod audio;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::capture_screen,
            commands::list_displays,
            commands::capture_window,
            commands::capture_region,
            commands::show_region_selector,
            commands::close_region_selector,
            commands::submit_region_selection,
            commands::start_recording,
            commands::stop_recording,
            commands::check_screen_recording_permission,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
