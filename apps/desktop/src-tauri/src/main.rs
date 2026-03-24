#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  tauri::Builder::default()
    .setup(|_app| {
      // Placeholder for system tray, notifications, and file access setup.
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
