#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod overlay;
mod recording;
mod audio;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        // Will add later: updater
        .invoke_handler(tauri::generate_handler![
            commands::capture_screen,
            commands::list_displays,
            commands::capture_window,
            commands::capture_region,
            commands::show_region_selector,
            commands::close_region_selector,
            commands::submit_region_selection,
            commands::show_screen_selector,
            commands::close_screen_selector,
            commands::select_display,
            commands::start_recording,
            commands::stop_recording,
            commands::check_screen_recording_permission,
            commands::show_countdown,
            commands::close_countdown,
            commands::hide_main_window,
            commands::show_main_window,
            commands::get_cursor_position,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
