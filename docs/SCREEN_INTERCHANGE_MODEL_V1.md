# Screen Interchange Model V1

Phase 4A introduces `src/screen-interchange` as a renderer-independent
authoring exchange boundary for LCD screens.

## Scope

- Package kind: `lcd-bitmap-screen-interchange`.
- Version: `1`.
- Source schema: project schema v5.
- Inputs: `LcdBitmapProject` and `LcdScreen`.
- Outputs: project-level or single-screen packages.
- Non-goals: Screen DSL, JSON user import, C or binary generation, visual
  snapshots, MCP, AI, Operation Registry and Behavior DSL.

## Package Shape

- `project`: project id, name, schema version, display and exported screen
  order.
- `screens`: screen metadata, display, object order, authoring objects and
  linked FSM state ids.
- `resources`: fonts, glyph overrides and bitmap bytes referenced by screens.
- `traceability`: source project, screen, object and resource references.

The model preserves authoring intent. It does not contain rendered framebuffers,
C arrays or backend compiler IR.

## Public API

- `projectToScreenInterchange(project, options)`
- `screenToScreenInterchangePackage(project, screenId)`
- `screenInterchangeToLcdScreens(packageV1)`
- `validateScreenInterchange(packageV1)`
- `serializeScreenInterchange(packageV1)`
- `fingerprintScreenInterchange(packageV1)`

The application layer exposes read-only facade helpers in
`src/application/screenInterchangeFacade.ts`.
