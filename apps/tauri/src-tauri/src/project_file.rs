use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};

const MAX_FILE_BYTES: u64 = 25 * 1024 * 1024;

/// Tracks the absolute path of the project currently open in this window, so
/// "Save" can write back to it directly without a dialog. The renderer never
/// learns this path — only a basename is ever returned.
#[derive(Default)]
pub struct ProjectFileState(Mutex<Option<PathBuf>>);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDiagnostic {
    code: String,
    severity: String,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenResult {
    cancelled: bool,
    filename: Option<String>,
    content: Option<String>,
    byte_length: Option<usize>,
    diagnostics: Vec<FileDiagnostic>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveRequest {
    suggested_filename: String,
    content: String,
    #[serde(default)]
    force_dialog: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    cancelled: bool,
    filename: Option<String>,
    byte_length: Option<usize>,
    saved_to_known_path: bool,
    diagnostics: Vec<FileDiagnostic>,
}

#[tauri::command]
pub fn project_open(state: tauri::State<'_, ProjectFileState>) -> Result<OpenResult, String> {
    let picked = rfd::FileDialog::new()
        .add_filter("LCD Bitmap Project", &["lcdproj", "json"])
        .pick_file();
    let Some(path) = picked else {
        return Ok(OpenResult {
            cancelled: true,
            filename: None,
            content: None,
            byte_length: None,
            diagnostics: vec![],
        });
    };

    let metadata = fs::metadata(&path).map_err(|error| error.to_string())?;
    if metadata.is_dir() {
        return Ok(OpenResult {
            cancelled: false,
            filename: file_name(&path),
            content: None,
            byte_length: None,
            diagnostics: vec![diagnostic(
                "PROJECT_FILE_IS_DIRECTORY",
                format!("\"{}\" is a directory.", file_name(&path).unwrap_or_default()),
            )],
        });
    }
    if metadata.len() > MAX_FILE_BYTES {
        return Ok(OpenResult {
            cancelled: false,
            filename: file_name(&path),
            content: None,
            byte_length: Some(metadata.len() as usize),
            diagnostics: vec![diagnostic(
                "PROJECT_FILE_TOO_LARGE",
                format!("File exceeds the {MAX_FILE_BYTES}-byte limit."),
            )],
        });
    }

    let bytes = fs::read(&path).map_err(|error| error.to_string())?;
    let content = String::from_utf8(bytes.clone())
        .map_err(|_| "Project file must be valid UTF-8.".to_owned())?;

    *state.0.lock().unwrap() = Some(path.clone());

    Ok(OpenResult {
        cancelled: false,
        filename: file_name(&path),
        content: Some(content),
        byte_length: Some(bytes.len()),
        diagnostics: vec![],
    })
}

#[tauri::command]
pub fn project_save(
    request: SaveRequest,
    state: tauri::State<'_, ProjectFileState>,
) -> Result<SaveResult, String> {
    if request.content.len() as u64 > MAX_FILE_BYTES {
        return Err(format!("Project content exceeds the {MAX_FILE_BYTES}-byte limit."));
    }

    let known_path = if request.force_dialog {
        None
    } else {
        state.0.lock().unwrap().clone()
    };

    let target = match known_path.clone() {
        Some(path) => path,
        None => {
            let suggested = safe_filename(&request.suggested_filename);
            let picked = rfd::FileDialog::new()
                .add_filter("LCD Bitmap Project", &["lcdproj"])
                .set_file_name(&suggested)
                .save_file();
            match picked {
                Some(path) => path,
                None => {
                    return Ok(SaveResult {
                        cancelled: true,
                        filename: None,
                        byte_length: None,
                        saved_to_known_path: false,
                        diagnostics: vec![],
                    })
                }
            }
        }
    };

    fs::write(&target, request.content.as_bytes()).map_err(|error| error.to_string())?;
    *state.0.lock().unwrap() = Some(target.clone());

    Ok(SaveResult {
        cancelled: false,
        filename: file_name(&target),
        byte_length: Some(request.content.len()),
        saved_to_known_path: known_path.is_some(),
        diagnostics: vec![],
    })
}

#[tauri::command]
pub fn project_reset_path(state: tauri::State<'_, ProjectFileState>) -> Result<(), String> {
    *state.0.lock().unwrap() = None;
    Ok(())
}

fn safe_filename(value: &str) -> String {
    let stem = value
        .trim()
        .trim_end_matches(".lcdproj")
        .chars()
        .map(|character| if "<>:\"/\\|?*".contains(character) { '_' } else { character })
        .collect::<String>();
    let stem = if stem.is_empty() { "project" } else { stem.as_str() };
    format!("{stem}.lcdproj")
}

fn file_name(path: &Path) -> Option<String> {
    path.file_name().map(|name| name.to_string_lossy().into_owned())
}

fn diagnostic(code: &str, message: String) -> FileDiagnostic {
    FileDiagnostic {
        code: code.to_owned(),
        severity: "error".to_owned(),
        message,
    }
}
