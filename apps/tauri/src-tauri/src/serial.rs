use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use serialport::{SerialPort, SerialPortType};
use std::{
    io::Write,
    sync::Mutex,
    time::{Duration, Instant},
};

#[derive(Default)]
pub struct SerialState(Mutex<SerialConnection>);

#[derive(Default)]
struct SerialConnection {
    port: Option<Box<dyn SerialPort>>,
    path: Option<String>,
    protocol_connected: bool,
    last_error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortInfo {
    path: String,
    manufacturer: Option<String>,
    serial_number: Option<String>,
    vendor_id: Option<String>,
    product_id: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    open: bool,
    protocol_connected: bool,
    path: Option<String>,
    last_error: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandRequest {
    command_id: String,
    argument: Option<Value>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandResult {
    command: String,
    raw: String,
    parsed: Value,
    duration_ms: u128,
}

#[tauri::command]
pub fn serial_list() -> Result<Vec<PortInfo>, String> {
    serialport::available_ports()
        .map_err(|error| error.to_string())
        .map(|ports| {
            ports
                .into_iter()
                .map(|item| {
                    let (manufacturer, serial_number, vendor_id, product_id) =
                        match item.port_type {
                            SerialPortType::UsbPort(info) => (
                                info.manufacturer,
                                info.serial_number,
                                Some(format!("{:04X}", info.vid)),
                                Some(format!("{:04X}", info.pid)),
                            ),
                            _ => (None, None, None, None),
                        };
                    PortInfo {
                        path: item.port_name,
                        manufacturer,
                        serial_number,
                        vendor_id,
                        product_id,
                    }
                })
                .collect()
        })
}

#[tauri::command]
pub fn serial_open(path: String, state: tauri::State<'_, SerialState>) -> Result<Status, String> {
    if !serialport::available_ports()
        .map_err(|error| error.to_string())?
        .iter()
        .any(|port| port.port_name == path)
    {
        return Err(format!("Serial port \"{path}\" is not available."));
    }
    let port = serialport::new(&path, 115_200)
        .data_bits(serialport::DataBits::Eight)
        .parity(serialport::Parity::None)
        .stop_bits(serialport::StopBits::One)
        .flow_control(serialport::FlowControl::None)
        .timeout(Duration::from_millis(120))
        .open()
        .map_err(|error| error.to_string())?;
    let mut connection = state
        .0
        .lock()
        .map_err(|_| "Serial state lock failed.".to_owned())?;
    connection.port = Some(port);
    connection.path = Some(path);
    connection.protocol_connected = false;
    connection.last_error = None;
    Ok(status_of(&connection))
}

#[tauri::command]
pub fn serial_close(state: tauri::State<'_, SerialState>) -> Result<Status, String> {
    let mut connection = state
        .0
        .lock()
        .map_err(|_| "Serial state lock failed.".to_owned())?;
    connection.port = None;
    connection.path = None;
    connection.protocol_connected = false;
    Ok(status_of(&connection))
}

#[tauri::command]
pub fn serial_status(state: tauri::State<'_, SerialState>) -> Result<Status, String> {
    let connection = state
        .0
        .lock()
        .map_err(|_| "Serial state lock failed.".to_owned())?;
    Ok(status_of(&connection))
}

#[tauri::command]
pub fn serial_command(
    request: CommandRequest,
    state: tauri::State<'_, SerialState>,
) -> Result<CommandResult, String> {
    let (command, response_kind, expected_lines, requires_connection) =
        command_contract(&request)?;
    let mut connection = state
        .0
        .lock()
        .map_err(|_| "Serial state lock failed.".to_owned())?;
    if requires_connection && !connection.protocol_connected {
        return Err(format!(
            "Send \"connect\" successfully before \"{}\".",
            request.command_id
        ));
    }
    let port = connection
        .port
        .as_mut()
        .ok_or_else(|| "Open a serial port before sending an ECROS command.".to_owned())?;
    let started = Instant::now();
    port.write_all(format!("{command}\r").as_bytes())
        .map_err(|error| error.to_string())?;
    port.flush().map_err(|error| error.to_string())?;

    let timeout = if matches!(
        request.command_id.as_str(),
        "rezero" | "resetdark" | "boot"
    ) {
        Duration::from_secs(30)
    } else {
        Duration::from_secs(5)
    };
    let raw = read_response(port.as_mut(), response_kind, expected_lines, timeout)?;
    let parsed = parse_response(&request.command_id, response_kind, expected_lines, &raw)?;
    if request.command_id == "connect" {
        connection.protocol_connected = true;
    } else if request.command_id == "quit" {
        connection.protocol_connected = false;
    }
    connection.last_error = None;
    Ok(CommandResult {
        command,
        raw,
        parsed,
        duration_ms: started.elapsed().as_millis(),
    })
}

fn status_of(connection: &SerialConnection) -> Status {
    Status {
        open: connection.port.is_some(),
        protocol_connected: connection.protocol_connected,
        path: connection.path.clone(),
        last_error: connection.last_error.clone(),
    }
}

fn command_contract(
    request: &CommandRequest,
) -> Result<(String, &'static str, Option<usize>, bool), String> {
    let (kind, lines, requires_connection, accepts_argument) =
        match request.command_id.as_str() {
            "connect" => ("ok", None, false, false),
            "quit" | "boot" => ("none", None, true, false),
            "rezero" => ("rezero", Some(2), true, false),
            "getdark" | "resetdark" => ("integer-list", Some(8), true, false),
            "ge" => (
                "integer-list",
                request
                    .argument
                    .as_ref()
                    .and_then(Value::as_u64)
                    .map(|value| value as usize),
                true,
                true,
            ),
            "sa" => ("none", None, true, true),
            "ga" | "getslit" => ("integer", Some(1), true, false),
            "gettype" | "getsoftver" | "help" | "company" | "getsample" | "getslip"
            | "ud" | "getsn" => ("text", None, true, false),
            "setsn" => ("text", None, true, true),
            other => return Err(format!("Unknown ECROS command \"{other}\".")),
        };
    let command = if accepts_argument {
        let argument = request.argument.as_ref().ok_or_else(|| {
            format!("Command \"{}\" requires an argument.", request.command_id)
        })?;
        let argument = argument
            .as_str()
            .map(str::to_owned)
            .unwrap_or_else(|| argument.to_string());
        format!("{} {}", request.command_id, argument.trim_matches('"'))
    } else {
        if request.argument.is_some() {
            return Err(format!(
                "Command \"{}\" does not accept an argument.",
                request.command_id
            ));
        }
        request.command_id.clone()
    };
    Ok((command, kind, lines, requires_connection))
}

fn read_response(
    port: &mut dyn SerialPort,
    response_kind: &str,
    expected_lines: Option<usize>,
    timeout: Duration,
) -> Result<String, String> {
    if response_kind == "none" {
        return Ok(String::new());
    }
    let started = Instant::now();
    let mut raw = Vec::new();
    let mut buffer = [0_u8; 1024];
    loop {
        match port.read(&mut buffer) {
            Ok(count) if count > 0 => {
                raw.extend_from_slice(&buffer[..count]);
                let text = String::from_utf8_lossy(&raw);
                let count = response_lines(&text).len();
                let has_line_terminator = text.contains('\r') || text.contains('\n');
                if (response_kind == "ok" && text.to_ascii_lowercase().contains("ok."))
                    || (response_kind == "integer" && has_line_terminator)
                    || expected_lines.is_some_and(|expected| count >= expected)
                {
                    break;
                }
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::TimedOut => {
                if !raw.is_empty() && response_kind == "text" {
                    break;
                }
            }
            Err(error) => return Err(error.to_string()),
        }
        if started.elapsed() >= timeout {
            return Err(format!(
                "ECROS command timed out after {} ms.",
                timeout.as_millis()
            ));
        }
    }
    Ok(String::from_utf8_lossy(&raw).into_owned())
}

fn response_lines(raw: &str) -> Vec<&str> {
    raw.lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('>'))
        .collect()
}

fn parse_response(
    command_id: &str,
    kind: &str,
    expected: Option<usize>,
    raw: &str,
) -> Result<Value, String> {
    let lines = response_lines(raw);
    match kind {
        "none" => Ok(json!({ "kind": "none" })),
        "ok" if lines.join(" ").to_ascii_lowercase() == "ok." => {
            Ok(json!({ "kind": "ok" }))
        }
        "ok" => Err(format!("Command \"{command_id}\" expected \"ok.\".")),
        "integer" => Ok(json!({
            "kind": "integer",
            "value": integer_at(&lines, 0, command_id)?
        })),
        "integer-list" => {
            if expected.is_some_and(|count| count != lines.len()) {
                return Err(format!(
                    "Command \"{command_id}\" returned an unexpected number of lines."
                ));
            }
            let values = lines
                .iter()
                .enumerate()
                .map(|(index, _)| integer_at(&lines, index, command_id))
                .collect::<Result<Vec<_>, _>>()?;
            Ok(json!({ "kind": "integer-list", "values": values }))
        }
        "rezero" if lines.len() == 2 => Ok(json!({
            "kind": "rezero",
            "referenceAdc": integer_at(&lines, 0, command_id)?,
            "gain": integer_at(&lines, 1, command_id)?
        })),
        "rezero" => Err("Command \"rezero\" expected two lines.".to_owned()),
        "text" => Ok(json!({ "kind": "text", "value": lines.join("\n") })),
        _ => Err(format!("Unsupported response kind \"{kind}\".")),
    }
}

fn integer_at(lines: &[&str], index: usize, command_id: &str) -> Result<i64, String> {
    lines
        .get(index)
        .ok_or_else(|| format!("Command \"{command_id}\" returned too few lines."))?
        .parse::<i64>()
        .map_err(|_| format!("Command \"{command_id}\" returned a non-integer value."))
}
