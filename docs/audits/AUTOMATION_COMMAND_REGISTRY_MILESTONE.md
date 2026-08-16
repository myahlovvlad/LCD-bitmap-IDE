# Automation command registry milestone

Date: 2026-08-16

Branch: `feat/automation-command-registry`

Scope: first verification-first delivery stage

## Result

The editor now has one schema-driven automation registry executed in the renderer. UI/store mutations, Electron REST/MCP and Tauri REST/MCP converge on the application command bus, revisioned project session, semantic ChangeSets, undo history, notification feedback and automation audit.

## Capability matrix

| Capability | Status | Evidence |
|---|---|---|
| Registry metadata and JSON Schemas | Implemented | `src/shared/automation/registry.ts` |
| UI/application command parity | Implemented with explicit exclusions | `src/shared/automation/parity.ts`, parity test |
| `expectedRevision` conflicts | Implemented | Renderer dispatcher and dispatcher tests |
| Idempotency and replay outcome | Implemented | Bounded per-project cache and replay audit |
| Dry-run semantic diff | Implemented | Single-command preview and atomic `preview_changes` |
| Atomic batch apply and one-step undo | Implemented | Application ChangeSet execution |
| Structured success/failure/blocked/conflict/noop | Implemented | Shared `AutomationOutcome` contract |
| Audit and visible operation feedback | Implemented | Bounded audit log and notification store integration |
| FSM/state/event/transition CRUD and layout | Implemented | Registry-to-command mappings and ELK handler |
| Screen CRUD/reorder | Implemented | Registry-to-command mappings |
| Tags/procedures/alarms | Implemented | Direct store writes replaced by application commands |
| Validation, compilation and runtime events | Implemented | Renderer-owned read/runtime adapters |
| Electron REST/MCP | Implemented | Generated tools and generic `/api/v1/commands/{name}` |
| Tauri REST/MCP parity | Implemented | Loopback Rust adapters forwarding to renderer |
| Hardware verification | Blocked | No target, probe, firmware addresses or readback fixture supplied |

## Security and failure controls

- Servers bind only to `127.0.0.1` and reject unsafe Host/Origin values.
- Request bodies are capped at 10 MiB; renderer calls time out after 5 seconds.
- `LCD_IDE_AUTOMATION_TOKEN` enables constant-time bearer-token verification.
- `X-LCD-IDE-Scopes` limits read, write, destructive and runtime permissions.
- Correlation IDs join transport responses, notifications and audit entries.
- Port collisions do not silently rebind to a public or random interface.
- Malformed envelopes and command payloads return structured diagnostics.

## Compatibility and rollback

Electron's existing unversioned `/api/*` endpoints remain compatibility aliases and translate through the renderer registry. `compile_screen` remains a deprecated alias of `compile_assets`. Rollback is limited to this branch/PR: the change adds no project-schema migration and therefore does not rewrite `.lcdproj` files.

## Verification evidence

- `npm ci`: clean install completed; the existing dependency tree reports one low and four high advisories for separate dependency review.
- `npm test`: 92 files, 634 tests passed.
- Compiler, FSM behavior and Screen DSL acceptance suites passed.
- `npm run test:renderer`, `npm run build` and Electron Playwright smoke passed.
- `cargo check` passed; Tauri automation unit tests passed 3/3.
- Browser E2E passed 37/41 with eight workers; the four resource-timeout scenarios then passed 7/7 with one worker. Visual regression passed 2/2.

The Windows Rust toolchain intermittently terminated third-party crate compilation with `STATUS_ACCESS_VIOLATION`; sequential retries completed both check and tests. No Rust assertion or project compilation error remained.

## Deferred work

The next independent stage is schema-v7 `DisplayProfile` round-trip support, followed by screen catalog, FSM templates, raster animation and firmware evidence. No hardware claim is treated as passed by this software-only milestone.
