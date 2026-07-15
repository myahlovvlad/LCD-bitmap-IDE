# Data Model

Phase 3A adds `FsmInterchangeModelV1` as an authoring interchange contract for
FSM scripts. It is not a schema-v5 persisted field and it is not compiler IR.
The persisted `.lcdproj` model remains schema-v5.

Phase 4A adds `ScreenInterchangeProjectV1` as an authoring interchange contract
for LCD screens. It is not a schema-v5 persisted field, not renderer state and
not compiler IR.

## Native Schema v5

Schema-v5 contracts are owned by `src/domain/project.ts`. The legacy
`src/model/project.ts` import path re-exports the same contracts for
compatibility. Renderer code may import domain contracts, but domain, model,
services and entities must not import renderer modules.

```ts
interface LcdBitmapProject {
  meta: ProjectMeta;
  display: DisplayConfig;
  screens: Record<string, LcdScreen>;
  screenOrder: string[];
  fonts: Record<string, BitmapFont>;
  glyphs: Record<string, ProjectGlyph>;
  fsm: FsmModel;
  controlPanel: ControlPanelModel;
  backendProcesses: Record<string, BackendProcess>;
  bindings: ProjectBindings;
  validation: ValidationState;
}
```

FSM states reference LCD screens through `state.screenId`. Transitions reference
events through `transition.trigger.eventId`; panel buttons reference the same
events through `button.fsmEventId`. Screens and states therefore have independent
lifecycles and IDs.

`bindings` is a derived index for reverse lookups. Direct references on states,
transitions, buttons and screen objects remain authoritative.

## Session Revision

Application commands run against an in-memory `ProjectSession`:

```ts
interface ProjectSession {
  project: LcdBitmapProject;
  revision: number;
}
```

`revision` is not part of schema v5 and is not persisted in `.lcdproj` files.
It is a local mutation ordering token for command execution, dry-run previews
and future external adapters.

## Transient Script Documents

Phase 3C adds `FsmScriptDocumentSession` for Script Studio authoring state. The
session stores current source text, source/FSM fingerprints, preview metadata
and stale/dirty status in memory only. It is keyed by project ID and format.

Unapplied Mermaid/Python-like DSL drafts are not persisted in `.lcdproj`, do not
create command history and are not compiler input. The persisted schema-v5
project continues to contain the canonical FSM graph and behavior fields.

## Portable `.lcdproj`

```ts
interface LcdProject {
  projectId: string;
  formatVersion: "1.0";
  name: string;
  deviceModel: string;
  firmwareVersion: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  screens: PortableScreen[];
  stateMachine: {
    states: FsmState[];
    transitions: FsmTransition[];
  };
  fontData: unknown;
}
```

`screens[]` contains portable screen metadata and `DisplayObject[]`. FSM states reference screens by ID, so one screen can be reused by multiple workflows in compatible professional tools.

## Legacy Internal Project

The following structure is accepted only by migration and legacy import tools:

- `states: Record<string, FsmState>`
- `transitions: Record<string, FsmTransition>`
- `canvasByStateId: Record<string, CanvasData>`
- `stateOrder: string[]`
- `transitionOrder: string[]`

It is converted to schema v5 before entering the application store.

## Bitmap Packing

Screen firmware export is monochrome 1 bpp, vertical pages, LSB at top. A 128x64 screen is `128 * 8 = 1024` bytes.

## Compiler IR v1

Phase 2A adds `NormalizedCompilerIrV1` as a derived, versioned compiler model.
It is built from a read-only `CompilerSourceSnapshot` and is not persisted in
`.lcdproj` files. Schema-v5 remains the source of truth.

The compiler snapshot includes project data plus project-associated auxiliary
font and measurement state. It excludes application revision, command history,
undo/redo cursor, processed command IDs, savepoints, selections, active
workspace, IDE locale, zoom, dialogs, file paths and validation timestamps from
fingerprints.

## Screen Interchange Model V1

`ScreenInterchangeProjectV1` is a derived package owned by
`src/screen-interchange`. It contains project metadata, exported screens,
resource refs, resource payloads and traceability. It preserves current
schema-v5 screen authoring data while extracting bitmap bytes and inline glyph
overrides into package resources.

`selectedObjectIds` remains UI state. It is excluded from authoring equality
and carried only as trace metadata for optional reconstruction.

## 2026-06-16 Update

- `FsmState.stateType` is normalized to `initial`, `process`, `success` or `failure` for built-in FSM markings.
- `FsmTransition.sourceHandle` and `FsmTransition.targetHandle` preserve the selected graph connection side (`s-top`, `s-right`, `s-bottom`, `s-left`, `t-top`, `t-right`, `t-bottom`, `t-left`).
- `FsmTransition.trigger.mechanism` supports `event`, `button`, `timer` and `fact`, with optional `buttonId`, `timerMs` and `fact`.

## Known Limitations

- Legacy v1/v2/v4 imports do not contain handle information; migration defaults them to right-to-left or right self-loop handles.
- Conditional expressions intentionally use a small safe comparator grammar instead of arbitrary JavaScript execution.
- `src/renderer/types/domain.ts` remains as a temporary compatibility facade
  for renderer imports. It is not the source of truth for domain contracts.
- Lowered target IR and backend-specific memory layouts are deferred to Phase
  2B.
- Screen Interchange V1 does not define a Screen DSL, user-facing JSON import,
  C/HTML conversion or live synchronization.

## Changelog

- 2026-06-24: documented session-level command revision outside persisted
  schema-v5 project files.
- 2026-06-25: documented transient FSM script document sessions outside
  persisted schema-v5 project files.
- 2026-06-25: documented Screen Interchange Model V1 as a derived,
  non-persisted LCD screen authoring package.
- 2026-06-24: documented Phase 2A compiler IR as a derived, non-persisted
  schema-v5 projection.
- 2026-06-24: documented Phase 1A domain ownership and compatibility facades.
- 2026-06-16: added transition handle persistence, FSM state markings and transition mechanism fields.
