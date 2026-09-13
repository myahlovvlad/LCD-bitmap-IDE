# Editor, HMI and Delivery Redesign Plan

**Goal:** Turn the existing functional editors into one coherent firmware-model IDE, make the complete HMI chain traceable, explain every Runtime control state, and restore downloadable desktop releases.

## Task 1: Shared editor context

- Add a typed descriptor for LCD, Panel, Texts, DSL, Tags, Procedures and Alarms.
- Render the same context header above each editor: model stage, purpose, entity count and validation status.
- Keep existing editor internals and mutation APIs unchanged.
- Verify route coverage, localization and theme-layer tokens in Vitest/Playwright.

## Task 2: Annotation 1 — HMI trace

- Build a pure trace resolver for FSM state → LCD screen → physical button → event/tag → procedure → alarm.
- Show the selected chain as explicit linked stages in HMI Design/Simulation/Coverage.
- Link every resolvable stage back to its editor and mark absent links as gaps.
- Add unit tests for complete and incomplete chains.

## Task 3: Explainable Runtime controls

- List all visible physical buttons, not only currently reachable controls.
- Resolve and show a localized reason for every unavailable button.
- Distinguish missing event, state allow/deny rule, missing transition, failed guard and running procedure.
- Keep simulated/express time visibly separate from project data.

## Task 4: HMI handoff wizard

- Recompose Handoff into Validate → Supplier package → Device connection.
- Prevent package step from presenting a ready state when blocking validation remains.
- Include software/project/schema identity and the explicit non-firmware limitation.
- Retain the current package builder and serial tools inside their respective steps.

## Task 5: Desktop delivery

- Audit Electron, Tauri and GitHub Actions/release metadata.
- Repair local build scripts and CI artifact/release paths.
- Build Windows artifacts locally where the toolchain permits and document exact artifact locations/checksums.
- Verify GitHub release downloads or report the precise external publishing blocker.

## Task 6: Acceptance verification

- Run full Vitest, renderer/Electron type checks, renderer build and focused Playwright flows.
- Open the September ECROS project and verify themes, HMI trace, Runtime buttons, timer label and handoff stages.
