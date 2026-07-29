# Conceptual Model

This document defines the vocabulary and source-of-truth rules for LCD-bitmap
IDE. It is the bridge between the user workflow and the code architecture.

## One Project, Several Views

`LcdBitmapProject` is the canonical engineering model. The workspaces do not own
independent documents; each workspace edits or evaluates one part of the same
project.

| Concern | Canonical project data | Primary workspace |
|---|---|---|
| Device behavior | FSM states, events and transitions | FSM |
| Operator display | Screens, canvas objects, fonts and glyphs | LCD |
| Physical interaction | Panel elements and event bindings | Control panel |
| Runtime values | Tags and data sources | Tags |
| Device actions | Procedures and CLI catalog | Procedures |
| Fault behavior | Alarm definitions | Alarms |
| Verification | Derived runtime session and validation issues | Runtime |
| Structured screen authoring | Transient DSL document applied through a ChangeSet | Screen DSL |
| Localization handoff | Project text resources | Text registry |
| Firmware delivery | Derived artifacts and manifests | Handoff |

## Identity And Relationships

Entities are connected by stable IDs:

```text
button.fsmEventId ─┐
                   ├─> event.id <─ transition.trigger.eventId
state.screenId ────────────────> screen.id
screen object/tag binding ─────> tag.id
runtime action ────────────────> procedure.id
```

Display labels can change; IDs are integration contracts. Import, migration,
automation and firmware handoff all depend on them.

## State Categories

Keep these categories separate:

1. **Persisted domain state** — the schema-6 project saved in `.lcdproj`.
2. **Application state** — revision, command context, ChangeSets and history.
3. **Transient authoring state** — uncommitted FSM or Screen DSL text and preview.
4. **UI state** — active workspace, selection, zoom, dialogs and language.
5. **Runtime state** — current simulated state, tag values, logs and requests.
6. **Compiler state** — normalized and lowered derived representations.

Only the first category is the project source of truth. Application commands are
the normal mutation boundary. A parser, preview, renderer or compiler must not
mutate the domain model directly.

## Main Data Flow

```text
Open/import
    ↓ validate and migrate
Schema-6 LcdBitmapProject
    ↓ application command / atomic ChangeSet
ProjectSession revision + history
    ├─→ React/Zustand adapter → workspaces
    ├─→ runtime projection → simulation and validation
    ├─→ compiler snapshot → normalized IR → target IR → artifacts
    └─→ canonical save → .lcdproj
```

Legacy formats are accepted at the import boundary and normalized before they
enter the store. Schema 5 is supported as a legacy input; schema 6 is current.

## Workspace Order

The interface currently exposes eleven top-level workspaces. Their conceptual
order is:

1. **Design:** FSM, LCD, Control panel.
2. **Integrate:** Tags, Procedures, Alarms.
3. **Validate:** Runtime.
4. **Deliver:** Text registry, Handoff.
5. **Advanced authoring/configuration:** Screen DSL, Settings.

This grouping is conceptual today; progressive grouping in the navigation is a
tracked UX debt item.

## Architectural Invariants

- `src/domain` is framework-independent and owns project contracts.
- `src/application` owns commands, sessions, revisions and atomic changes.
- `src/services` owns migration, validation, interoperability and runtime logic.
- interchange and DSL packages are boundary formats, not parallel domain models.
- `src/compiler` consumes read-only snapshots and produces deterministic output.
- `src/renderer` and `src/features` adapt the model to the UI.
- Electron and Tauri are replaceable desktop shells around the shared renderer.

Boundary tests enforce the most important dependency rules. See
[ARCHITECTURE.md](ARCHITECTURE.md) for the directory map.
