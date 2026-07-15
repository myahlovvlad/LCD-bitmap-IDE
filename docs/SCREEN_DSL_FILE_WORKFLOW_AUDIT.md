# Screen DSL File Workflow Audit

Date: 2026-06-25

## Existing Electron Pattern

The app uses `src/main/main.ts` for Electron IPC registration and
`src/preload/preload.cts` for `contextBridge.exposeInMainWorld`. Existing PDF
export and clipboard APIs are narrow feature methods, not a generic bridge.
The Screen DSL file workflow follows that pattern.

Electron security remains:

- `contextIsolation: true`;
- `nodeIntegration: false`;
- renderer has no `fs` or `path` import for file workflow.

## Boundary Decision

Shared serializable contracts live in `src/shared/screenDslFiles/`. They contain
types, channel constants, diagnostics and pure validation helpers. They do not
import Electron, Node filesystem APIs, React, Zustand or project sessions.

The renderer calls a feature adapter:

`ScreenDslStudio -> ScreenDslFileAdapter -> preload -> typed IPC -> main`.

The adapter is injectable so browser tests can provide an in-memory
implementation. Production delegates to
`window.spectroDesigner.screenDslFiles`.

## Main-Process Validation

Open workflow:

1. open a restricted dialog;
2. stat the dialog-selected path;
3. reject directories and oversized files;
4. validate extension;
5. read bounded bytes;
6. strict UTF-8 decode;
7. return basename, content, format and byte length.

Save workflow:

1. runtime-validate IPC payload;
2. reject extra keys including `path`;
3. sanitize suggested filename;
4. open save dialog;
5. append missing canonical extension;
6. reject mismatched explicit extension;
7. write UTF-8 via sibling temp file and rename;
8. return basename and byte length.

## Known Remaining Work

Browser Playwright workflows and targeted Electron workflow are not completed in
this slice. They remain Phase 4B.5 follow-up work.
