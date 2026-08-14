# Verification-first gap analysis

Baseline: `d7f7259583752f620a5a368f9d6733c7eff4b944`
Audit date: 2026-08-14

## Executive result

The repository already has a normalized compiler IR, application command bus, revisioned project sessions, semantic ChangeSets, Electron REST/MCP adapters, Screen/FSM DSLs and a Tauri shell. It is not yet a complete verification-first IDE: the display model remains legacy monochrome, Tauri has no REST/MCP transport, firmware patch/readback evidence is absent, and hardware claims cannot be verified in this repository alone.

This baseline closes the most immediate contract leaks: `authoringLanguage` is command-driven and undoable, byte length is owned by one encoder boundary, notifications retain explicit operation outcomes, and critical FSM read-only/layout behavior is corrected.

## Capability matrix

| Capability | Status | Evidence / gap |
|---|---|---|
| Application command bus + revision + undo | Implemented | `src/application/commandBus.ts`, `projectSession.ts` |
| `authoringLanguage` command path | Implemented in this baseline | `project.setAuthoringLanguage`, REST/MCP mappings and tests |
| Normalized compiler IR | Implemented | `src/compiler/ir`, `normalization`, deterministic fixtures |
| Unified legacy display encoder boundary | Implemented in this baseline | `src/compiler/encoding/displayEncoder.ts` |
| First-class versioned `DisplayProfile` + decoder | Missing | Project schema remains v6 and mono/vertical-LSB |
| Screen DSL and FSM interchange | Implemented | Safe parsers, preview/apply and acceptance tests exist |
| Parameterized FSM template DSL | Missing | No template/instance registry or bounded template executor |
| Screen groups/index modes | Missing | `screenOrder` exists; group hierarchy does not |
| Animation assets | Missing | No `AnimationAsset` domain, timeline or codecs |
| Electron local REST/MCP | Partial | Local-only transport exists; registry/parity is incomplete |
| Tauri REST/MCP | Missing | Tauri supports clipboard/files/serial only |
| Notification and explicit operation feedback | Implemented in this baseline | Persistent center, unread history, running/success/failure states |
| Autosave | Partial | Debounced local snapshot exists; policy, retention and crash UI do not |
| C/H/BIN and portable embedded exports | Partial | Multiple codegen backends exist; HEX/ELF patching does not |
| Firmware readback/evidence bundle | Missing | No device adapters or canonical comparison bundle |
| Hardware verification | Blocked by equipment | Requires target, probe, firmware symbols/addresses and readback fixture |

## Baseline observations

- `authoringLanguage` existed, but its setter replaced project/store state directly.
- Byte length was repeated as `width * ceil(height / 8)` in compiler normalization, renderer utilities and handoff mapping.
- Tauri does not expose the Electron REST/MCP contract.
- CI workflows now exist, but the manual hardware checks associated with the baseline cannot be closed without equipment.
- README download links referenced `0.1.3` while package/Tauri versions were `0.1.18`; links are synchronized in this baseline.
- Existing toasts were local to `App.tsx`, ephemeral and had no operation identity/history.

## UI → command → transport map

| Operation | UI/store | Command bus | REST | MCP | Electron | Tauri |
|---|---|---|---|---|---|---|
| Set LCD content language | `setAuthoringLanguage` | `project.setAuthoringLanguage` | `PUT /api/project/authoring-language` | `set_authoring_language` | IPC dispatcher | Missing transport |
| Read LCD content language | Settings/project | n/a | `GET /api/project/authoring-language` | `get_authoring_language` | cached project | Missing transport |
| FSM CRUD | FSM workspace/store | FSM commands | Partial | Partial | IPC dispatcher | Missing transport |
| Screen reorder | store only | `screen.reorder` | Missing | Missing | dispatcher can be extended | Missing |
| Compile screens | UI/compiler facade | read-only compile path | `POST /api/compile` | `compile_screen` | renderer dispatcher | Missing transport |
| Notification feedback | global notification store | command failures/outcomes can publish | n/a | n/a | renderer | renderer-compatible |

## Hardware-only verification

The following cannot be marked passed without a real target and documented setup:

- ST-Link/J-Link/OpenOCD/UART flash success and disconnect recovery;
- framebuffer or resource readback from a known address/symbol;
- firmware-before/after hashes taken from the physical target;
- pixel equality between canonical raster and device readback;
- timing, RAM/Flash and controller packing conformance on target hardware.

Required protocol inputs: exact instrument/controller, probe and versions, firmware image and symbols, allowed flash region, framebuffer/resource address and size, connection settings, golden project and expected raster/hash.
