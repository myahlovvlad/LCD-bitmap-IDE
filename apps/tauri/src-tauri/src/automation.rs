use serde::Serialize;
use serde_json::{json, Map, Value};
use std::{
    collections::HashMap,
    io::Read,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        mpsc::{sync_channel, SyncSender},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};
use tauri::{AppHandle, Emitter, State};
use tiny_http::{Header, Request, Response, Server, StatusCode};

const REST_PORT: u16 = 8766;
const MCP_PORT: u16 = 8767;
const MAX_BODY_BYTES: u64 = 10 * 1024 * 1024;
const RENDERER_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Default)]
struct AutomationRuntime {
    pending: Mutex<HashMap<String, SyncSender<Value>>>,
    sequence: AtomicU64,
    shutdown: AtomicBool,
}

#[derive(Clone, Default)]
pub struct AutomationState(Arc<AutomationRuntime>);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RendererAutomationEvent {
    request_id: String,
    action: &'static str,
    payload: Value,
}

pub fn start_servers(app: AppHandle, state: AutomationState) {
    spawn_server(app.clone(), state.clone(), REST_PORT, TransportKind::Rest);
    spawn_server(app, state, MCP_PORT, TransportKind::Mcp);
}

pub fn stop_servers(state: &AutomationState) {
    state.0.shutdown.store(true, Ordering::SeqCst);
    state
        .0
        .pending
        .lock()
        .expect("automation pending mutex poisoned")
        .clear();
}

#[tauri::command]
pub fn automation_respond(
    state: State<'_, AutomationState>,
    request_id: String,
    response: Value,
) -> Result<(), String> {
    let sender = state
        .0
        .pending
        .lock()
        .map_err(|_| "automation pending mutex poisoned".to_string())?
        .remove(&request_id)
        .ok_or_else(|| "automation request is no longer pending".to_string())?;
    sender
        .send(response)
        .map_err(|_| "automation response receiver closed".to_string())
}

#[derive(Clone, Copy)]
enum TransportKind {
    Rest,
    Mcp,
}

fn spawn_server(app: AppHandle, state: AutomationState, port: u16, kind: TransportKind) {
    thread::spawn(move || {
        let address = format!("127.0.0.1:{port}");
        let server = match Server::http(&address) {
            Ok(server) => server,
            Err(error) => {
                eprintln!("[automation] {address} unavailable: {error}");
                return;
            }
        };
        while !state.0.shutdown.load(Ordering::SeqCst) {
            match server.recv_timeout(Duration::from_millis(250)) {
                Ok(Some(request)) => handle_request(request, &app, &state, port, kind),
                Ok(None) => {}
                Err(error) => {
                    eprintln!("[automation] receive failed on {address}: {error}");
                    break;
                }
            }
        }
    });
}

fn handle_request(
    mut request: Request,
    app: &AppHandle,
    state: &AutomationState,
    port: u16,
    kind: TransportKind,
) {
    if let Err((status, message)) = validate_local_request(&request, port) {
        respond_json(request, status, json!({ "error": message }));
        return;
    }
    if request.method().as_str() == "OPTIONS" {
        respond_json(request, 204, Value::Null);
        return;
    }
    let result = match kind {
        TransportKind::Rest => handle_rest(&mut request, app, state),
        TransportKind::Mcp => handle_mcp(&mut request, app, state),
    };
    match result {
        Ok((status, body)) => respond_json(request, status, body),
        Err((status, message)) => respond_json(request, status, json!({ "error": message })),
    }
}

fn handle_rest(
    request: &mut Request,
    app: &AppHandle,
    state: &AutomationState,
) -> Result<(u16, Value), (u16, String)> {
    let method = request.method().as_str();
    let url = request.url().split('?').next().unwrap_or(request.url());
    if method == "GET" && url == "/api/v1/health" {
        return Ok((200, json!({ "ok": true, "transport": "tauri-rest" })));
    }
    let (command, envelope) = if method == "GET" && url == "/api/v1/capabilities" {
        ("get_capabilities".to_string(), Map::new())
    } else if method == "GET" && url == "/api/v1/revision" {
        ("get_project_revision".to_string(), Map::new())
    } else if method == "POST" && url.starts_with("/api/v1/commands/") {
        let command = percent_decode(&url["/api/v1/commands/".len()..]);
        let value = read_json_body(request)?;
        (command, normalize_envelope(value)?)
    } else {
        return Err((404, "Not found".to_string()));
    };
    let payload = automation_payload(&command, envelope, request, "tauri-rest", state)?;
    let outcome = forward_to_renderer(app, state, payload)?;
    Ok((outcome_http_status(&outcome), outcome))
}

fn handle_mcp(
    request: &mut Request,
    app: &AppHandle,
    state: &AutomationState,
) -> Result<(u16, Value), (u16, String)> {
    if request.method().as_str() != "POST" || request.url().split('?').next() != Some("/mcp") {
        return Err((404, "Not found".to_string()));
    }
    let message = read_json_body(request)?;
    let id = message.get("id").cloned().unwrap_or(Value::Null);
    let method = message.get("method").and_then(Value::as_str).unwrap_or("");
    let result = match method {
        "initialize" => json!({
            "protocolVersion": "2024-11-05",
            "capabilities": { "tools": {} },
            "serverInfo": { "name": "lcd-bitmap-ide-tauri", "version": "1.0.0" }
        }),
        "tools/list" => {
            let payload =
                automation_payload("get_capabilities", Map::new(), request, "tauri-mcp", state)?;
            let outcome = forward_to_renderer(app, state, payload)?;
            let tools = outcome
                .pointer("/output/mcpTools")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            json!({ "tools": tools })
        }
        "tools/call" => {
            let params = message
                .get("params")
                .and_then(Value::as_object)
                .ok_or((400, "Missing MCP params".to_string()))?;
            let command = params
                .get("name")
                .and_then(Value::as_str)
                .ok_or((400, "Missing MCP tool name".to_string()))?;
            let arguments = params
                .get("arguments")
                .cloned()
                .unwrap_or_else(|| json!({}));
            let envelope = normalize_envelope(arguments)?;
            let payload = automation_payload(command, envelope, request, "tauri-mcp", state)?;
            let outcome = forward_to_renderer(app, state, payload)?;
            let is_error = matches!(
                outcome.get("status").and_then(Value::as_str),
                Some("failure" | "blocked" | "conflict")
            );
            json!({
                "content": [{ "type": "text", "text": serde_json::to_string_pretty(&outcome).unwrap_or_default() }],
                "structuredContent": outcome,
                "isError": is_error
            })
        }
        _ => {
            return Ok((
                200,
                json!({ "jsonrpc": "2.0", "id": id, "error": { "code": -32601, "message": "Method not found" } }),
            ))
        }
    };
    Ok((200, json!({ "jsonrpc": "2.0", "id": id, "result": result })))
}

fn automation_payload(
    command: &str,
    mut envelope: Map<String, Value>,
    request: &Request,
    source: &str,
    state: &AutomationState,
) -> Result<Value, (u16, String)> {
    authorize_token(request)?;
    let input = envelope.remove("input").unwrap_or_else(|| json!({}));
    let correlation_id = envelope
        .remove("correlationId")
        .and_then(|value| value.as_str().map(str::to_string))
        .filter(|value| !value.trim().is_empty() && value.len() <= 256)
        .unwrap_or_else(|| format!("tauri-{}", state.0.sequence.fetch_add(1, Ordering::SeqCst)));
    let scopes = header_value(request, "X-LCD-IDE-Scopes")
        .map(|value| {
            value
                .split(|character| character == ',' || character == ' ')
                .filter(|scope| {
                    matches!(
                        *scope,
                        "project:read" | "project:write" | "project:destructive" | "runtime:write"
                    )
                })
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_else(|| {
            vec![
                "project:read".into(),
                "project:write".into(),
                "project:destructive".into(),
                "runtime:write".into(),
            ]
        });
    let mut payload = json!({
        "command": command,
        "input": input,
        "correlationId": correlation_id,
        "source": source,
        "permissions": scopes,
        "actor": { "id": format!("automation:{source}"), "type": "adapter", "displayName": source },
        "dryRun": envelope.remove("dryRun").and_then(|value| value.as_bool()).unwrap_or(false)
    });
    if let Some(revision) = envelope
        .remove("expectedRevision")
        .and_then(|value| value.as_u64())
    {
        payload["expectedRevision"] = json!(revision);
    }
    if let Some(key) = envelope
        .remove("idempotencyKey")
        .and_then(|value| value.as_str().map(str::to_string))
    {
        payload["idempotencyKey"] = json!(key);
    }
    Ok(payload)
}

fn forward_to_renderer(
    app: &AppHandle,
    state: &AutomationState,
    payload: Value,
) -> Result<Value, (u16, String)> {
    let request_id = format!(
        "request-{}",
        state.0.sequence.fetch_add(1, Ordering::SeqCst)
    );
    let (sender, receiver) = sync_channel(1);
    state
        .0
        .pending
        .lock()
        .map_err(|_| (500, "automation pending mutex poisoned".to_string()))?
        .insert(request_id.clone(), sender);
    let event = RendererAutomationEvent {
        request_id: request_id.clone(),
        action: "automation.execute",
        payload,
    };
    if let Err(error) = app.emit("automation-request", event) {
        state
            .0
            .pending
            .lock()
            .ok()
            .and_then(|mut pending| pending.remove(&request_id));
        return Err((500, format!("failed to emit renderer request: {error}")));
    }
    receiver.recv_timeout(RENDERER_TIMEOUT).map_err(|_| {
        state
            .0
            .pending
            .lock()
            .ok()
            .and_then(|mut pending| pending.remove(&request_id));
        (504, "renderer automation request timed out".to_string())
    })
}

fn normalize_envelope(value: Value) -> Result<Map<String, Value>, (u16, String)> {
    let mut object = value
        .as_object()
        .cloned()
        .ok_or((400, "JSON body must be an object".to_string()))?;
    if !object.contains_key("input") {
        let mut input = object.clone();
        for key in [
            "expectedRevision",
            "idempotencyKey",
            "dryRun",
            "correlationId",
        ] {
            input.remove(key);
        }
        object.insert("input".to_string(), Value::Object(input));
    }
    Ok(object)
}

fn read_json_body(request: &mut Request) -> Result<Value, (u16, String)> {
    if header_value(request, "Content-Length")
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(0)
        > MAX_BODY_BYTES
    {
        return Err((413, "Request body exceeds the 10 MB limit".to_string()));
    }
    let mut body = String::new();
    request
        .as_reader()
        .take(MAX_BODY_BYTES + 1)
        .read_to_string(&mut body)
        .map_err(|error| (400, error.to_string()))?;
    if body.len() as u64 > MAX_BODY_BYTES {
        return Err((413, "Request body exceeds the 10 MB limit".to_string()));
    }
    serde_json::from_str(&body).map_err(|error| (400, format!("Invalid JSON: {error}")))
}

fn validate_local_request(request: &Request, port: u16) -> Result<(), (u16, String)> {
    let expected = [format!("127.0.0.1:{port}"), format!("localhost:{port}")];
    if !header_value(request, "Host").is_some_and(|host| expected.iter().any(|item| item == host)) {
        return Err((403, "Untrusted Host header".to_string()));
    }
    if let Some(origin) = header_value(request, "Origin") {
        if !is_local_origin(origin) {
            return Err((403, "Untrusted Origin header".to_string()));
        }
    }
    Ok(())
}

fn authorize_token(request: &Request) -> Result<(), (u16, String)> {
    let Ok(expected) = std::env::var("LCD_IDE_AUTOMATION_TOKEN") else {
        return Ok(());
    };
    let supplied = header_value(request, "Authorization")
        .and_then(|value| value.strip_prefix("Bearer "))
        .unwrap_or("");
    if !constant_time_equal(supplied.as_bytes(), expected.as_bytes()) {
        return Err((401, "Missing or invalid local automation token".to_string()));
    }
    Ok(())
}

fn is_local_origin(origin: &str) -> bool {
    let Some(authority) = origin.strip_prefix("http://") else {
        return false;
    };
    if authority.contains(['/', '?', '#', '@']) {
        return false;
    }
    let (hostname, port) = authority
        .split_once(':')
        .map_or((authority, None), |(host, port)| (host, Some(port)));
    matches!(hostname, "127.0.0.1" | "localhost")
        && port.is_none_or(|value| {
            !value.is_empty() && value.chars().all(|character| character.is_ascii_digit())
        })
}

fn constant_time_equal(left: &[u8], right: &[u8]) -> bool {
    let mut difference = left.len() ^ right.len();
    for index in 0..left.len().max(right.len()) {
        difference |= usize::from(
            left.get(index).copied().unwrap_or(0) ^ right.get(index).copied().unwrap_or(0),
        );
    }
    difference == 0
}

fn header_value<'a>(request: &'a Request, name: &str) -> Option<&'a str> {
    request
        .headers()
        .iter()
        .find(|header| header.field.as_str().as_str().eq_ignore_ascii_case(name))
        .map(|header| header.value.as_str())
}

fn outcome_http_status(value: &Value) -> u16 {
    match value.get("status").and_then(Value::as_str) {
        Some("success" | "noop") => 200,
        Some("conflict" | "cancelled") => 409,
        Some("blocked") => 403,
        _ => 400,
    }
}

fn respond_json(request: Request, status: u16, value: Value) {
    let allowed_origin = header_value(&request, "Origin")
        .filter(|origin| is_local_origin(origin))
        .map(str::to_string);
    let body = if status == 204 {
        String::new()
    } else {
        serde_json::to_string_pretty(&value).unwrap_or_else(|_| "{}".to_string())
    };
    let mut response = Response::from_string(body).with_status_code(StatusCode(status));
    for (name, value) in [
        ("Content-Type", "application/json; charset=utf-8"),
        ("Access-Control-Allow-Methods", "GET, POST, OPTIONS"),
        (
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization, X-LCD-IDE-Scopes, X-Correlation-ID",
        ),
    ] {
        if let Ok(header) = Header::from_bytes(name.as_bytes(), value.as_bytes()) {
            response.add_header(header);
        }
    }
    if let Some(origin) = allowed_origin {
        if let Ok(header) = Header::from_bytes("Access-Control-Allow-Origin", origin.as_bytes()) {
            response.add_header(header);
        }
        if let Ok(header) = Header::from_bytes("Vary", "Origin") {
            response.add_header(header);
        }
    }
    let _ = request.respond(response);
}

fn percent_decode(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut result = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            if let Ok(decoded) = u8::from_str_radix(&value[index + 1..index + 3], 16) {
                result.push(decoded);
                index += 3;
                continue;
            }
        }
        result.push(bytes[index]);
        index += 1;
    }
    String::from_utf8_lossy(&result).into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn inline_body_becomes_registry_input() {
        let envelope =
            normalize_envelope(json!({ "language": "ru", "expectedRevision": 3 })).unwrap();
        assert_eq!(envelope["expectedRevision"], 3);
        assert_eq!(envelope["input"]["language"], "ru");
    }

    #[test]
    fn outcome_statuses_have_stable_http_mapping() {
        assert_eq!(outcome_http_status(&json!({ "status": "success" })), 200);
        assert_eq!(outcome_http_status(&json!({ "status": "conflict" })), 409);
        assert_eq!(outcome_http_status(&json!({ "status": "blocked" })), 403);
    }

    #[test]
    fn origin_and_token_helpers_reject_prefix_spoofing() {
        assert!(is_local_origin("http://127.0.0.1:8766"));
        assert!(is_local_origin("http://localhost"));
        assert!(!is_local_origin("http://localhost.evil.example"));
        assert!(!is_local_origin("https://localhost:8766"));
        assert!(constant_time_equal(b"secret", b"secret"));
        assert!(!constant_time_equal(b"secret", b"secret2"));
    }
}
