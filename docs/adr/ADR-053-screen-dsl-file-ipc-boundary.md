# ADR-053: Screen DSL File IPC Boundary

Status: accepted

Screen Schema Studio needs file open/export without giving renderer code a
generic filesystem bridge.

Decision:

- use shared serializable contracts in `src/shared/screenDslFiles`;
- expose only `screenDslFiles.open()` and `screenDslFiles.save(request)` from
  preload;
- use static IPC channels;
- keep path selection in Electron dialogs owned by the main process;
- return basenames only to renderer;
- make the renderer depend on an injectable `ScreenDslFileAdapter`.

Consequences:

- browser tests can use an in-memory adapter;
- main process owns extension, size, UTF-8 and payload validation;
- Screen DSL session/application layers remain Electron-independent;
- no automatic Preview or Apply can happen from file open.
