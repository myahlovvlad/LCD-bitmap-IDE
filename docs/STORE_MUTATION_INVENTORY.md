# Store Mutation Inventory

Phase 1B.2 starts from the Zustand store state at commit `2d6b3d5`. This
inventory classifies every public `projectStore.ts` method and its helper
logic before migration to the application command/history layer.

## Completion Status

Phase 1B.2 is complete on branch `refactor/complete-store-command-history`
through commit `fbab65e`. Canonical project mutations and project-associated
auxiliary state now flow through `ProjectSession` and `executeProjectCommand`.
The renderer store keeps UI-only selection/language state, local screen template
storage, and selection reconciliation, but no longer owns project snapshot
history or business mutation helpers.

Undo/redo now applies application command history patches via
`undoProjectSession` and `redoProjectSession`. `captureHistory` is retained as a
renderer interaction affordance: it marks the next meaningful no-history command
as one command-history entry, so drag/resize interactions remain undoable
without reintroducing snapshot stacks.

## Classification

| Class | Meaning | Examples |
| --- | --- | --- |
| Canonical engineering state | Affects schema-v5 project data, validation, generated output or firmware export. Must mutate through application commands. | Project metadata, display, FSM, screens, canvas objects, control panel |
| Project-associated auxiliary state | Saved/exported with project snapshots or affects generated output, but currently sits beside `LcdBitmapProject`. Must be part of `ApplicationWorkspace`. | `fontGlyphs`, `loadedFonts`, `savedMeasurements` |
| Local preferences/resources | Local browser/Electron resources. Use repositories/services, not project commands. | Screen templates, workspace layouts, local save history, autosave storage |
| UI-only state | Renderer interaction state. Remains in Zustand. | Selection, active workspace, language, modal state, temporary drag/hover state |

## Public Store Methods

| Operation | Data touched | Class | `.lcdproj` | Autosave | Generated output | Current implementation | Target command/service | Aggregate boundary | Validation | History policy | Migration status | Characterization |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `setLanguage` | IDE language | UI-only / snapshot metadata | Yes, as file language | Yes | No | direct Zustand set | Renderer preference/session field | UI shell | None | No command history | Retain in renderer | E2E locale |
| `loadProjectSnapshot` | project, language, font data, measurements, selections, history root | Session lifecycle | Yes | Source of autosave restore | Yes | refresh project and reset stacks | `createApplicationSession` | Application session root | Full project validation | New history root | To migrate | Project migration tests, E2E autosave |
| `selectState` | selected state/transition | UI-only | No | No | No | direct Zustand set | Renderer only | UI selection | None | No history | Retain in renderer | E2E navigation |
| `selectScreen` | selected screen | UI-only | No | No | No | direct Zustand set | Renderer only | UI selection | None | No history | Retain in renderer | E2E LCD navigation |
| `selectTransition` | selected transition | UI-only | No | No | No | direct Zustand set | Renderer only | UI selection | None | No history | Retain in renderer | Typecheck/E2E |
| `selectControlElements` | selected panel elements | UI-only | No | No | No | direct Zustand set | Renderer only | UI selection | None | No history | Retain in renderer | Control-panel E2E |
| `validate` | project validation timestamp/issues | Derived diagnostics | Yes, derived | Yes | Blocks export/preview | direct validation write | Application validation refresh/query | Project | Full validation | No undo | Migrate as query/refresh | Validation tests |
| `updateProjectMetadata` | `project.meta.name/version/updatedAt` | Canonical engineering state | Yes | Yes | Export metadata | Phase 1B.1 command | `project.updateMetadata` | Project meta | Full validation | Command history | Migrated in 1B.1 | `commandBus`, adapter tests |
| `updateDisplayConfig` | display, all screen sizes, timestamps | Canonical engineering state | Yes | Yes | Yes, framebuffer/export dimensions | `mutateProject` | `project.updateDisplayConfig` | Project display/screens | Clamp + full validation | Command history | Remaining | Add characterization |
| `addFsmState` | FSM state, linked screen, graph layout | Canonical engineering state | Yes | Yes | Yes | Phase 1B.1 command | `fsm.state.add` | FSM + screens | Full validation | Command history | Migrated in 1B.1 | Command tests |
| `updateFsmState` | FSM state, linked screen name | Canonical engineering state | Yes | Yes | Yes | Phase 1B.1 command | `fsm.state.update` | FSM + screens | Full validation | Command history | Migrated in 1B.1 | Command tests |
| `deleteFsmState` | FSM state, linked screen, transitions, graph layout | Canonical engineering state | Yes | Yes | Yes | Phase 1B.1 command | `fsm.state.delete` | FSM + screens | Full validation | Command history | Migrated in 1B.1 | Command tests |
| `addFsmTransition` | events, transitions | Canonical engineering state | Yes | Yes | Runtime/codegen | Phase 1B.1 command | `fsm.transition.add` | FSM | Endpoint/event validation | Command history | Migrated in 1B.1 | Command tests |
| `updateFsmTransition` | transition | Canonical engineering state | Yes | Yes | Runtime/codegen | Phase 1B.1 command | `fsm.transition.update` | FSM | Full validation | Command history | Migrated in 1B.1 | Command tests |
| `deleteFsmTransition` | transition order/record | Canonical engineering state | Yes | Yes | Runtime/codegen | Phase 1B.1 command | `fsm.transition.delete` | FSM | Full validation | Command history | Migrated in 1B.1 | Command tests |
| `updateGraphPosition` | FSM graph layout | Canonical engineering state | Yes | Yes | No firmware, yes project layout | `mutateProject` | `fsm.graphPosition.update` | FSM layout | State existence | Command history, mergeable for drag | Remaining | Add characterization |
| `updateGraphPositions` | FSM graph layout batch | Canonical engineering state | Yes | Yes | No firmware, yes project layout | `mutateProject` | `fsm.graphPositions.update` | FSM layout | Known state IDs | One ChangeSet/history entry | Remaining | Add characterization |
| `ensureStateScreen` | linked screen, state `screenId`, selection | Canonical + UI selection | Yes | Yes | Yes | ID generation in store | `fsm.state.ensureScreen` | FSM + screens | Full validation | Command history | Remaining | Add characterization |
| `createScreen` | screen, linked FSM state, graph layout | Canonical engineering state | Yes | Yes | Yes | Phase 1B.1 command | `screen.create` | Screens + FSM | Full validation | Command history | Migrated in 1B.1 | Adapter tests |
| `duplicateScreen` | screen clone, object IDs, linked state, graph layout | Canonical engineering state | Yes | Yes | Yes | ID generation in store | `screen.duplicate` | Screens + FSM | Full validation | Command history | Remaining | Add characterization |
| `renameScreen` | screen name, linked state titles | Canonical engineering state | Yes | Yes | Export metadata | Phase 1B.1 command | `screen.rename` | Screens + FSM | Name sanitization + validation | Command history | Migrated in 1B.1 | Adapter tests |
| `resizeScreen` | screen dimensions | Canonical engineering state | Yes | Yes | Yes | `mutateProject` | `screen.resize` | Screen | Clamp + validation | Command history | Remaining | Add characterization |
| `deleteScreen` | screen, linked states/transitions/layout | Canonical engineering state | Yes | Yes | Yes | Phase 1B.1 command | `screen.delete` | Screens + FSM | Full validation | Command history | Migrated in 1B.1 | Adapter tests |
| `reorderScreens` | screen order | Canonical engineering state | Yes | Yes | Export ordering | `mutateProject` | `screen.reorder` | Screens | Normalize known IDs | Command history | Remaining | Add characterization |
| `saveScreenTemplate` | local template repository | Local resource | No | No | No | `localStorage` in store | `TemplateRepository.save` | Local templates | JSON parse boundary | No project history | Move to repository/service | Manual/UI tests |
| `createScreenFromTemplate` | project screen/state from local template | Canonical engineering state | Yes | Yes | Yes | reads localStorage + mutates project | `screen.createFromTemplate` plus template repository read | Screens + FSM | Full validation | Command history | Remaining | Add characterization |
| `addControlElement` | control panel element/order | Canonical engineering state | Yes | Yes | Runtime input model | ID generation in store | `controlPanel.element.add` | Control panel | Full validation | Command history | Remaining | Add characterization |
| `updateControlElement` | control panel element | Canonical engineering state | Yes | Yes | Runtime input model | `mutateProject` or no-history mutate | `controlPanel.element.update` | Control panel | Element type/id preservation | Command history or mergeable no-history | Remaining | Add characterization |
| `deleteControlElements` | panel elements/order/group links | Canonical engineering state | Yes | Yes | Runtime input model | cascade logic in store | `controlPanel.elements.delete` | Control panel | Full validation | Command history | Remaining | Add characterization |
| `groupControlElements` | group element and child `groupId`s | Canonical engineering state | Yes | Yes | Runtime input model | geometry + ID in store | `controlPanel.elements.group` | Control panel | At least 2 children | Command history | Remaining | Add characterization |
| `ungroupControlElements` | removes groups and child links | Canonical engineering state | Yes | Yes | Runtime input model | cascade logic in store | `controlPanel.elements.ungroup` | Control panel | Group existence | Command history | Remaining | Add characterization |
| `alignControlElements` | panel element geometry | Canonical engineering state | Yes | Yes | Runtime input model | geometry in store | `controlPanel.elements.align` | Control panel | At least 2 known IDs | Command history | Remaining | Add characterization |
| `updateControlPanelSettings` | panel size/grid/background | Canonical engineering state | Yes | Yes | Runtime input model | `mutateProject` | `controlPanel.settings.update` | Control panel | Full validation | Command history | Remaining | Add characterization |
| `undo` | project, auxiliary state, selections | Application history + UI selection | No | Autosave sees restored workspace | Yes | snapshot restore | `undoApplicationSession` | Application session | Revalidate restored workspace | Patch history | Replace | Add history tests |
| `redo` | project, auxiliary state, selections | Application history + UI selection | No | Autosave sees restored workspace | Yes | snapshot restore | `redoApplicationSession` | Application session | Revalidate restored workspace | Patch history | Replace | Add history tests |
| `captureHistory` | history stack | Interaction history control | No | No direct data change | No | snapshot push | `beginHistoryCapture` / merge policy | Application session | None | Merge high-frequency updates | Replace | Add high-frequency test |
| `updateCanvasObject` | screen object | Canonical engineering state | Yes | Yes | Yes | update by object ID | `canvas.object.update` | Screen canvas | Screen/object existence | Command history or mergeable no-history | Remaining | Add characterization |
| `setCanvasSelection` | screen selected object IDs | Canonical auxiliary in schema-v5 screen | Yes | Yes | No firmware | no-history project mutate | `canvas.selection.set` | Screen canvas | Known screen | No undo by default | Remaining | Add characterization |
| `addCanvasObject` | screen objects + selected IDs | Canonical engineering state | Yes | Yes | Yes | store mutation | `canvas.object.add` | Screen canvas | Full validation | Command history | Remaining | Add characterization |
| `addBitmapLayer` | generated bitmap object | Canonical engineering state | Yes | Yes | Yes | `Date.now()` ID in store then `addCanvasObject` | `canvas.bitmapLayer.add` | Screen canvas | Screen existence | Command history | Remaining | Add characterization |
| `updateCanvasObjects` | entire screen object list | Canonical engineering state | Yes | Yes | Yes | store mutation, optional no-history | `canvas.objects.update` | Screen canvas | Screen existence | Command history or mergeable no-history | Remaining | Add characterization |
| `deleteSelectedCanvasObjects` | screen objects + selection | Canonical engineering state with UI-derived facade | Yes | Yes | Yes | reads screen selection | `canvas.objects.delete` with explicit IDs | Screen canvas | Known IDs | Command history | Remaining | Add characterization |
| `updateGlyph` | font glyph table | Project-associated auxiliary state | Yes | Yes | Yes, text/glyph/codegen output | direct auxiliary set + snapshot | `font.glyph.update` | Font workspace | Variant/char | Command history | Remaining | Add characterization |
| `importFontGlyphs` | font glyph table, loaded font metadata | Project-associated auxiliary state | Yes | Yes | Yes | `applyImportedFont` in store | `font.glyphs.import` | Font workspace | Merge mode | Command history | Remaining | Add characterization |
| `addSavedMeasurement` | measurements | Project-associated auxiliary state | Yes | Yes | No firmware | direct set, no undo today | `measurement.add` | Measurement workspace | State existence optional | Command history after migration | Remaining | Add characterization |
| `updateSavedMeasurement` | measurements | Project-associated auxiliary state | Yes | Yes | No firmware | direct set, no undo today | `measurement.update` | Measurement workspace | ID existence | Command history after migration | Remaining | Add characterization |
| `deleteSavedMeasurement` | measurements | Project-associated auxiliary state | Yes | Yes | No firmware | direct set, no undo today | `measurement.delete` | Measurement workspace | ID existence | Command history after migration | Remaining | Add characterization |

## Helper Inventory

| Helper | Current role | Target |
| --- | --- | --- |
| `mutateProject` | Captures snapshot, applies project mutation, refreshes bindings/validation and reconciles selection. | Replace with single application command gateway plus renderer selection reconciliation. |
| `commitProjectCommand` | Phase 1B.1 adapter around `executeProjectCommand`, still pushes snapshot history. | Replace with application session commit result and command history. |
| `mutateProjectWithoutHistory` | Applies canonical project mutation without undo stack. | Replace with command execution using non-recording or mergeable history policy. |
| `refreshProject` | Rebuilds bindings and validation. | Application command bus invariant step. |
| `snapshot` / `restore` | Deep clone project and auxiliary state for undo/redo. | Replace with command history entries containing semantic changes and reversible patches. |
| `createScreen`, `createScreenId`, `createControlElement`, `uniqueId`, `slug`, `insertAfter`, `omit`, `clamp` | Business mutation helpers in store. | Move into application mutation helpers. |
| `readTemplates` | Local template repository read. | Move behind `TemplateRepository`; project mutation receives explicit template payload. |
| `resolveSelection`, `resolveControlSelection` | UI selection reconciliation. | Keep in renderer adapter. |
| `clone`, `now` | Utility for store mutations. | ID/time generation moves to command context; clone only for local resource boundaries if needed. |

## Phase 1B.2 Migration Order

1. Add characterization tests for remaining store behavior.
2. Introduce `ApplicationWorkspace` for project plus saved auxiliary state.
3. Add command history, reversible patches, savepoint and processed command IDs.
4. Expand the command union for remaining canonical/auxiliary mutations.
5. Replace `mutateProject`, `mutateProjectWithoutHistory`, snapshot `undo`/`redo`
   and direct auxiliary mutations with a single application session gateway.
6. Leave language, selection and local resource repositories in renderer.
