mod screen_dsl;
mod serial;

use serial::SerialState;

#[tauri::command]
fn clipboard_write(text: String) -> Result<bool, String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|error| error.to_string())?;
    clipboard.set_text(text).map_err(|error| error.to_string())?;
    Ok(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SerialState::default())
        .invoke_handler(tauri::generate_handler![
            clipboard_write,
            screen_dsl::screen_dsl_open,
            screen_dsl::screen_dsl_save,
            serial::serial_list,
            serial::serial_open,
            serial::serial_close,
            serial::serial_status,
            serial::serial_command
        ])
        .run(tauri::generate_context!())
        .expect("failed to run LCD-bitmap IDE Tauri application");
}
