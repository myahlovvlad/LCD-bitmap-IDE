# Security

- No external CDN is used by the built renderer.
- `index.html` defines a CSP that blocks arbitrary objects and restricts scripts to same-origin Vite assets.
- Phase 3A Python-like FSM scripts are declarative text. The parser rejects
  executable constructs including `exec`, `eval`, `open`, dunder imports,
  subprocess access, loops and function/class definitions. Parser results are
  diagnostics only until explicit ChangeSet Apply.
- Phase 3A.1 keeps Apply disabled for parser errors, unsafe input and stale
  previews. The canonical Python-like DSL writer emits no import boilerplate;
  old import lines are accepted only as compatibility text and are not executed.
- Phase 3C auto-preview may parse and dry-run a ChangeSet, but it never applies
  one. Preview results are accepted only when project ID, format, request
  sequence, source fingerprint, base revision and FSM fingerprint still match
  the current document session.
- Phase 4A Screen Interchange packages are pure data. Validation rejects
  missing resource refs, invalid display geometry and unsupported packing before
  reconstruction. The read-only application facade does not execute commands,
  mutate session revision or touch command history.
- Project imports are validated through Zod before loading.
- Import files are limited to 10 MB.
- Export filenames are sanitized.
- Metadata entered through the new project dialog is sanitized as plain text.
- Import errors are displayed as user-facing messages and do not require stack traces in the UI.

The app is a local engineering tool and does not execute user-provided HTML or JavaScript from imported project files.

## Compiler Layer

- `src/compiler` does not execute imported code.
- It does not use `eval`, accept functions, read arbitrary filesystem paths or
  make network requests.
- It does not trust display names as identifiers; symbols are sanitized and
  collisions are diagnosed.
- It does not import renderer, React, Zustand, Electron, DOM or Canvas APIs.
- It avoids logging full project contents; tests assert deterministic
  fingerprints and counts instead.
- It diagnoses oversized bitmap resources.

## Controlled Script Synchronization

Dirty source is not overwritten by automatic refresh, and opaque legacy behavior
strings are not canonicalized by sync. The preview coordinator uses one active
logical request per document and rejects stale results without production-only
delay hooks.

## Screen Interchange

`src/screen-interchange` does not import renderer, React, Zustand, Electron,
compiler backends, filesystem or network APIs. It performs deterministic
serialization and validation only. Fingerprints are identity signals, not
cryptographic security proofs.

## 2026-06-16 Update

- Clipboard writes in Electron go through a narrow `clipboard-write` IPC channel that only accepts plain text.
- Manual PDF export renders generated manual HTML in a hidden Electron window with sandboxed web preferences and no node integration.
- Web builds retain a fallback clipboard path through `navigator.clipboard` and legacy textarea copy.

## Known Limitations

- Electron PDF export writes to a user-selected path and depends on the host OS save dialog.
- Imported project data is validated, but generated HTML manuals should still be treated as local documents rather than trusted web content.

## Changelog

- 2026-06-16: documented clipboard IPC and generated-document PDF export boundaries.
- 2026-06-24: documented Phase 2A compiler boundary and symbol/resource
  diagnostics.
- 2026-06-24: documented Phase 3A.1 Script Studio Preview/Apply safety states.
- 2026-06-25: documented Phase 3C auto-preview race protection and dirty draft
  preservation.
- 2026-06-25: documented Phase 4A Screen Interchange validation and read-only
  facade boundaries.
