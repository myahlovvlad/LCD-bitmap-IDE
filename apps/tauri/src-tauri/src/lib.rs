mod automation;
mod project_file;
mod screen_dsl;
mod serial;

use project_file::ProjectFileState;
use serial::SerialState;
use tauri::Manager;

#[tauri::command]
fn clipboard_write(text: String) -> Result<bool, String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|error| error.to_string())?;
    clipboard.set_text(text).map_err(|error| error.to_string())?;
    Ok(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let application = tauri::Builder::default()
        .manage(automation::AutomationState::default())
        .setup(|app| {
            let state = app.state::<automation::AutomationState>().inner().clone();
            automation::start_servers(app.handle().clone(), state);
            Ok(())
        })
        .manage(SerialState::default())
        .manage(ProjectFileState::default())
        .invoke_handler(tauri::generate_handler![
            automation::automation_respond,
            automation::automation_status,
            clipboard_write,
            project_file::project_open,
            project_file::project_save,
            project_file::project_reset_path,
            screen_dsl::screen_dsl_open,
            screen_dsl::screen_dsl_save,
            serial::serial_list,
            serial::serial_open,
            serial::serial_close,
            serial::serial_status,
            serial::serial_command
        ])
        .build(tauri::generate_context!())
        .expect("failed to build LCD-bitmap IDE Tauri application");
    let automation_state = application.state::<automation::AutomationState>().inner().clone();
    application.run(move |_app, event| {
        if matches!(event, tauri::RunEvent::Exit | tauri::RunEvent::ExitRequested { .. }) {
            automation::stop_servers(&automation_state);
        }
    });
}
