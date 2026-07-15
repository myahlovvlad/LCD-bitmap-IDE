# Screen DSL File Security

Date: 2026-06-25

Security controls:

- no generic filesystem bridge;
- no raw `ipcRenderer` exposure;
- no renderer-provided final save path;
- no absolute path returned to renderer;
- restricted open dialog filters;
- extension validation for `.lcdscreen.yaml`, `.lcdscreen.yml`,
  `.lcdscreen.json` and import aliases `.yaml`, `.yml`, `.json`;
- dangerous double extensions rejected;
- file-size check before read;
- strict UTF-8 decoding with fatal errors;
- UTF-16 BOM rejected;
- NUL bytes rejected;
- malformed save payload rejected before dialog;
- atomic save through unique sibling temp file and rename.

Opening a file only updates the transient Screen DSL draft. It does not mutate
the project, create history, preview automatically or apply automatically.
