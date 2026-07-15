# ADR-042: Screen DSL File IPC

Status: deferred after application facade

Screen DSL file import/export should follow the existing narrow preload/main IPC
pattern. Renderer code must not import `fs` or write arbitrary paths.

Main process must validate operation name, extension, payload size, filename and
cancellation state. File import loads text only; it never applies automatically.
