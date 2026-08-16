# Documentation Index

Use this page instead of scanning the `docs/` directory alphabetically.

## First-Time Users

- [Start Here](START_HERE.md) / [С чего начать](START_HERE.ru.md)
- [Operation manual](operation_manual.md)
- Generated manuals in English, Russian and Chinese:
  [docs/user-manuals/index.html](user-manuals/index.html)
- [HMI handoff guide](HMI_HANDOFF_GUIDE.md)

## Contributors

- [Conceptual model](CONCEPTUAL_MODEL.md)
- [Architecture](ARCHITECTURE.md)
- [FSM event scope audit](FSM_EVENT_SCOPE_AUDIT.md)
- [Data model](DATA_MODEL.md)
- [Testing](TESTING.md)
- [Security](SECURITY.md)
- [Traceability matrix](TRACEABILITY_MATRIX.md)
- [Technical debt register](TECHNICAL_DEBT.md)
- [Tauri/Rust migration plan](RUST_TAURI_MIGRATION_PLAN.md)

## Automation And Integration

- [API and MCP connectors](API_MCP_CONNECTORS.md)
- [LLM-native interface](LLM_NATIVE_INTERFACE.md)
- [Application command model](APPLICATION_COMMAND_MODEL.md)
- [HMI handoff guide](HMI_HANDOFF_GUIDE.md)
- [ECROS CLI and HMI operational contract](ECROS_CLI_PROTOCOL_NOTES.md)
- [Automation registry milestone](audits/AUTOMATION_COMMAND_REGISTRY_MILESTONE.md)
- [ADR-055: renderer-owned automation registry](adr/ADR-055-automation-command-registry.md)

## Specialized Design Documents

Documents prefixed with `FSM_`, `SCREEN_DSL_`, `SCREEN_INTERCHANGE_` and
`COMPILER_` describe individual contracts, decisions and acceptance criteria.
Start from the conceptual model and architecture before reading them.

## Document Status

- **Living documents:** this index, Start Here, conceptual model, architecture,
  data model, operation manual, testing, security, traceability and debt register.
  They must describe the current repository.
- **Decision and contract documents:** ADRs and subsystem specifications. They
  may preserve the terminology and constraints from the phase in which a
  decision was made.
- **Audits and roadmaps:** point-in-time evidence. Their dates and historical
  claims should not be rewritten to look current.
- **Generated manuals:** outputs of `npm run docs:user`. Edit their generator
  inputs, not the HTML/PDF/DOCX files by hand.
