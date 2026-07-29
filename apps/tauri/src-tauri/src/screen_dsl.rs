use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

const MAX_FILE_BYTES: u64 = 512 * 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDiagnostic {
    code: String,
    severity: String,
    message: String,
    filename: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenResult {
    cancelled: bool,
    format: Option<String>,
    filename: Option<String>,
    content: Option<String>,
    byte_length: Option<usize>,
    diagnostics: Vec<FileDiagnostic>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveRequest {
    format: String,
    operation: String,
    suggested_filename: String,
    content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    cancelled: bool,
    filename: Option<String>,
    byte_length: Option<usize>,
    diagnostics: Vec<FileDiagnostic>,
}

#[tauri::command]
pub async fn screen_dsl_open() -> Result<OpenResult, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let picked = rfd::FileDialog::new()
            .add_filter("Screen DSL", &["yaml", "yml", "json"])
            .pick_file();
        let Some(path) = picked else {
            return Ok(OpenResult {
                cancelled: true,
                format: None,
                filename: None,
                content: None,
                byte_length: None,
                diagnostics: vec![],
            });
        };

        let metadata = fs::metadata(&path).map_err(|error| error.to_string())?;
        if metadata.len() > MAX_FILE_BYTES {
            return Ok(OpenResult {
                cancelled: false,
                format: format_for_path(&path),
                filename: file_name(&path),
                content: None,
                byte_length: Some(metadata.len() as usize),
                diagnostics: vec![diagnostic(
                    "SCREEN_DSL_FILE_TOO_LARGE",
                    format!("File exceeds the {MAX_FILE_BYTES}-byte limit."),
                    &path,
                )],
            });
        }
        let bytes = fs::read(&path).map_err(|error| error.to_string())?;
        let content = String::from_utf8(bytes.clone())
            .map_err(|_| "Screen DSL file must be valid UTF-8.".to_owned())?;
        Ok(OpenResult {
            cancelled: false,
            format: format_for_path(&path),
            filename: file_name(&path),
            content: Some(content),
            byte_length: Some(bytes.len()),
            diagnostics: vec![],
        })
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn screen_dsl_save(request: SaveRequest) -> Result<SaveResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if request.content.len() as u64 > MAX_FILE_BYTES {
            return Err(format!("Screen DSL content exceeds the {MAX_FILE_BYTES}-byte limit."));
        }
        if request.format != "yaml" && request.format != "json" {
            return Err("Unsupported Screen DSL format.".to_owned());
        }
        if request.operation != "canonical-export" && request.operation != "draft-save" {
            return Err("Unsupported Screen DSL save operation.".to_owned());
        }
        let extension = if request.format == "json" { "json" } else { "yaml" };
        let suggested = safe_filename(&request.suggested_filename, extension);
        let picked = rfd::FileDialog::new()
            .add_filter("Screen DSL", &[extension])
            .set_file_name(&suggested)
            .save_file();
        let Some(path) = picked else {
            return Ok(SaveResult {
                cancelled: true,
                filename: None,
                byte_length: None,
                diagnostics: vec![],
            });
        };
        fs::write(&path, request.content.as_bytes()).map_err(|error| error.to_string())?;
        Ok(SaveResult {
            cancelled: false,
            filename: file_name(&path),
            byte_length: Some(request.content.len()),
            diagnostics: vec![],
        })
    })
    .await
    .map_err(|error| error.to_string())?
}

fn safe_filename(value: &str, extension: &str) -> String {
    let stem = value
        .trim()
        .trim_end_matches(".yaml")
        .trim_end_matches(".yml")
        .trim_end_matches(".json")
        .chars()
        .map(|character| if "<>:\"/\\|?*".contains(character) { '_' } else { character })
        .collect::<String>();
    let stem = if stem.is_empty() { "screen" } else { stem.as_str() };
    format!("{stem}.{extension}")
}

fn format_for_path(path: &Path) -> Option<String> {
    match path.extension()?.to_string_lossy().to_ascii_lowercase().as_str() {
        "json" => Some("json".to_owned()),
        "yaml" | "yml" => Some("yaml".to_owned()),
        _ => None,
    }
}

fn file_name(path: &Path) -> Option<String> {
    path.file_name().map(|name| name.to_string_lossy().into_owned())
}

fn diagnostic(code: &str, message: String, path: &Path) -> FileDiagnostic {
    FileDiagnostic {
        code: code.to_owned(),
        severity: "error".to_owned(),
        message,
        filename: file_name(path),
    }
}
