# Firmware Clone Runtime and FSM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the ECROS project runtime behave as a coherent firmware clone, including hardware notifications, executable UI paths and visual screen-to-screen checks.

**Architecture:** Keep ordinary operator navigation in project FSM transitions. Add a runtime-only hardware-notification overlay that preserves `currentStateId` and returns to it after acknowledgement or timeout. Use the MCP/REST project session to repair only evidence-backed missing edges, then execute deterministic scenario traces and compare rendered screens.

**Tech Stack:** TypeScript, React, Vitest, Playwright, Tauri local automation/MCP, existing LCD compiler.

**Spec:** `docs/superpowers/specs/2026-09-15-runtime-hardware-notifications-design.md`

## Global Constraints

- Do not add fictitious regular FSM arrows for USB, printer or PC status popups.
- Preserve project screen and export data; overlays exist only while the runtime is active.
- Use `io.usb_present`, `io.printer_present` and `io.pc_present` as the only hardware truth sources.
- Every repaired navigation edge must name its physical/virtual control and existing FSM event.
- A screen is removed only after its incoming/outgoing edges and replacement mapping are reviewed.

---

### Task 1: Runtime hardware-notification contract

**Files:**
- Modify: `src/services/runtimeEngine.ts`
- Modify: `src/services/runtime/orchestratedRuntimeEngine.ts`
- Create: `src/services/runtimeHardwareNotifications.ts`
- Test: `src/services/runtimeHardwareNotifications.test.ts`

**Interfaces:**
- Produces `HardwareNotification { equipment: 'usb'|'printer'|'pc'; present: boolean; screenId: string; returnStateId: string; openedAt: number }`.
- Produces `resolveHardwareNotification(project, tags, currentStateId): HardwareNotification | null`.
- Extends `RuntimeEngine` with `hardwareNotification`, `acknowledgeHardwareNotification()` and `refreshHardwareNotification()`.

- [ ] Write tests mapping all six presence/absence cases to the ECROS screen IDs and asserting unknown mappings return `null`.
- [ ] Run `npm test -- runtimeHardwareNotifications.test.ts` and confirm failure before implementation.
- [ ] Implement pure tag-to-screen mapping and runtime overlay storage; preserve `currentStateId` on open, replacement and clear it on start/reset.
- [ ] Implement acknowledgement and timeout return without emitting an FSM transition.
- [ ] Run the focused test and `npm test -- runtimeEngine`.
- [ ] Commit with `feat(runtime): add hardware notification overlay`.

### Task 2: Runtime UI and automation observability

**Files:**
- Modify: `src/features/runtime-workspace/RuntimeWorkspace.tsx`
- Modify: `src/renderer/automation/runtimeAutomation.ts`
- Modify: `src/renderer/automation/automationDispatcher.ts`
- Test: `src/features/runtime-workspace/RuntimeWorkspace.test.tsx`

**Interfaces:**
- Consumes `RuntimeEngine.hardwareNotification`.
- Extends automation state to `{ currentStateId, isRunning, hardwareNotification }`.

- [ ] Write a UI test: change `io.usb_present`, assert the mapped LCD overlay and the preserved underlying state; acknowledge and assert the original screen returns.
- [ ] Run the test and confirm it fails because no overlay is rendered.
- [ ] Render an accessible modal/overlay with equipment, status, mapped LCD bitmap, return-state label and acknowledgement button; prevent normal panel input while visible.
- [ ] Extend runtime automation state so MCP scenario checks assert notification state without pixel scraping.
- [ ] Run focused tests and the runtime workspace test suite.
- [ ] Commit with `feat(runtime-ui): render observable hardware overlays`.

### Task 3: Validation and reachability semantics

**Files:**
- Modify: `src/services/projectValidationService.ts`
- Test: `src/services/projectValidationService.test.ts`

**Interfaces:**
- Validation recognises the six configured notification screens as externally reachable.
- Missing hardware screen mapping or one of the three `io.*_present` tags is an explicit warning.

- [ ] Add failing fixtures for reachable notification screens without regular arrows and for a missing tag/screen mapping.
- [ ] Run `npm test -- projectValidationService` and confirm failure.
- [ ] Add notification-aware reachability classification while retaining ordinary directed-graph checks for every other state.
- [ ] Run focused validation tests plus the complete validation suite.
- [ ] Commit with `feat(validation): model external hardware reachability`.

### Task 4: Evidence-backed ECROS FSM reconciliation

**Files:**
- Modify through MCP: active `ECROS-5400UV…lcdproj` session only
- Create: `docs/ecros-5400uv-scenario-catalog.md`

**Interfaces:**
- Catalogue entry: `scenarioId`, `startState`, `control`, `eventId`, `expectedState`, `expectedScreenId`, `guard`.
- Each MCP mutation uses an atomic `apply_changes` batch and current revision.

- [ ] Record the boot, main-menu, photometry A/E/T, quantitative, kinetics, multiwavelength, settings, files, USB, PC and printer paths from actual screen labels and control-panel permissions.
- [ ] Preview each missing edge; reject any edge whose source control is absent or whose target screen does not match the selected label.
- [ ] Apply approved transitions atomically and append their change IDs to the catalogue.
- [ ] Mark only genuine diagnostic stop screens terminal; retain a visible operator-recovery route where the source mockup provides one.
- [ ] Re-run MCP `validate_project`; attach the warning breakdown to the catalogue.
- [ ] Commit the catalogue with `docs(ecros): record validated firmware scenarios`.

### Task 5: End-to-end behavioural and visual evidence

**Files:**
- Create: `tests/e2e/ecrosFirmwareScenarios.spec.ts`
- Create: `tests/fixtures/ecrosFirmwareScenarios.ts`

**Interfaces:**
- Scenario runner drives `fire_runtime_event`/panel controls, waits for timers, and asserts current state, screen ID, overlay and guard outcome.
- Visual assertions use `render_screen`/framebuffer comparison for every scenario checkpoint.

- [ ] Add failing boot-to-main-menu and one guarded USB notification trace.
- [ ] Add one trace per measurement mode plus files, settings, printer and PC status flows; include success, cancel and unavailable-device branches.
- [ ] Implement deterministic timer control and framebuffer checkpoint comparison with committed expected hashes.
- [ ] Run `npm test`, the new Playwright suite and `npm run build`.
- [ ] Export an evidence bundle and record its checksum in the scenario catalogue.
- [ ] Commit with `test(ecros): verify firmware-clone scenarios and visuals`.
