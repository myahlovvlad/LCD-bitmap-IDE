# IDE Shell and FSM Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a minimal, grouped IDE shell with an unambiguous software-version badge and a 2D FSM canvas whose viewport survives rerenders, workspace switching and reloads.

**Architecture:** Keep every existing `WorkspaceMode` and workspace component intact. `App.tsx` becomes the shell composition point for activity groups and the secondary navigator; an isolated FSM viewport-cache module owns non-project UI state, while `FsmWorkspace` restores and persists its React Flow viewport through that module.

**Tech Stack:** React 19, TypeScript, Vite, Electron/Tauri renderer, `@xyflow/react`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-11-ide-shell-redesign-design.md`

## Global Constraints

- Preserve `.lcdproj` schema, project revision semantics, router modes and MCP command names.
- Software version comes from `package.json` through a single build-time renderer value; invalid/missing build metadata renders `dev`.
- The user project’s `meta.version` remains an independent, editable value.
- FSM viewport state is UI-only and is keyed by project ID plus 2D graph representation; it never updates graph coordinates or project revision.
- Retain all existing functions; redesign layout and interaction presentation only.
- Keep primary actions accessible from 1024 px desktop width upward.

---

### Task 1: Build-time software-version contract

**Files:**
- Modify: `vite.config.ts`
- Modify: `src/renderer/vite-env.d.ts`
- Modify: `src/renderer/config/constants.ts`
- Test: `tests/utils/appVersion.test.ts`

**Interfaces:**
- Produces `APP_SOFTWARE_VERSION: string` from `src/renderer/config/constants.ts`.
- The renderer accesses only the declared compile-time global, never `package.json` at runtime.

- [ ] **Step 1: Write a failing unit test** for valid semantic version normalization and fallback to `dev`.
- [ ] **Step 2: Run** `npx vitest run tests/utils/appVersion.test.ts` and confirm the missing export/test fails.
- [ ] **Step 3: Define** the version global in Vite from `package.json` and declare it in `vite-env.d.ts`.
- [ ] **Step 4: Export** `APP_SOFTWARE_VERSION` from constants with a defensive `dev` fallback.
- [ ] **Step 5: Run** the focused test and `npm run typecheck`.
- [ ] **Step 6: Commit** the version-contract change.

### Task 2: Add a testable FSM viewport-cache boundary

**Files:**
- Create: `src/features/fsm/fsmViewportCache.ts`
- Test: `tests/utils/fsmViewportCache.test.ts`

**Interfaces:**
- Produces `FsmViewport`, `FsmViewportContext`, `readFsmViewport`, `writeFsmViewport`, and `clearInvalidFsmViewport`.
- `FsmViewportContext = { projectId: string; representation: 'all' | 'overview' | 'subsystem:<id>' }`.

- [ ] **Step 1: Write failing tests** for in-memory retention, local-storage reload, independent representation keys, and malformed JSON rejection.
- [ ] **Step 2: Run** `npx vitest run tests/utils/fsmViewportCache.test.ts` and observe the red state.
- [ ] **Step 3: Implement** the pure cache module using a versioned local-storage key and guarded browser-storage access.
- [ ] **Step 4: Verify** cache reads/writes do not import the project store or mutate project data.
- [ ] **Step 5: Run** the focused cache test and typecheck.
- [ ] **Step 6: Commit** the isolated cache module and its tests.

### Task 3: Make 2D FSM canvas restore the operator viewport

**Files:**
- Modify: `src/features/fsm/FsmWorkspace.tsx`
- Modify: `tests/e2e/app.spec.ts`
- Modify: `tests/e2e/pages/FsmWorkspacePage.ts`

**Interfaces:**
- Consumes `readFsmViewport(context)` / `writeFsmViewport(context, viewport)`.
- Extends the local React Flow instance reference to `getViewport()` and `setViewport(viewport, options?)` in addition to `fitView()`.
- Uses one `viewportContext` derived from `project.meta.id`, `overviewMode`, and `focusedSubsystem`.

- [ ] **Step 1: Add failing Playwright coverage**: set a non-default 2D zoom/pan, switch FSM → LCD → FSM, and assert the transform is unchanged.
- [ ] **Step 2: Add failing reload coverage**: reload with autosave and assert the saved transform is restored without changing the `.lcdproj` autosave payload/revision.
- [ ] **Step 3: Remove the unconditional mount/signature `fitView` path** that currently resets the viewport on every workspace remount.
- [ ] **Step 4: On React Flow initialization**, restore the cached viewport for the current context; if it is absent, fit represented state nodes once and persist the resulting viewport.
- [ ] **Step 5: Persist user navigation** from `onMoveEnd`; do not persist programmatic intermediate movement until it is complete.
- [ ] **Step 6: Restrict automatic fit** to explicit Auto arrange and a previously unseen graph representation. Keep Auto arrange’s post-layout fit exactly once.
- [ ] **Step 7: Preserve interaction semantics**: selection by left-drag on empty canvas; pan by middle/right drag; right-click context menu; node movement only in Edit mode.
- [ ] **Step 8: Run** `npx playwright test --config playwright.config.ts tests/e2e/app.spec.ts --grep "viewport"` and relevant FSM-script tests.
- [ ] **Step 9: Commit** the viewport behavior change.

### Task 4: Compose grouped minimal IDE shell

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/styles.css`
- Modify: `src/renderer/config/i18n.ts`
- Test: `tests/e2e/app.spec.ts`

**Interfaces:**
- Add a local `WORKSPACE_GROUPS` mapping from group ID to existing `WorkspaceMode[]`; do not change `WorkspaceRouter` types or route payloads.
- Render `data-testid="activity-<group>"`, `data-testid="workspace-navigator"`, `data-testid="software-version"` for stable browser tests.

- [ ] **Step 1: Write failing browser tests** for: software and project versions rendered separately; groups expose exactly their mapped existing workspace buttons; every workspace remains reachable; route navigation does not mutate project state.
- [ ] **Step 2: Implement** the compact header with product identity, editable project name, project/schema badge, read-only software-version badge, Open/Save/Export, language and Settings.
- [ ] **Step 3: Implement** activity bar plus labelled navigator using the four approved groups: Interface, Logic, Hardware, Verify and deliver.
- [ ] **Step 4: Move non-primary actions** (undo/redo/manual/wizard/history/new/demo) into compact secondary controls while preserving their keyboard shortcuts and existing test IDs.
- [ ] **Step 5: Replace shell-only CSS** with a minimal dark surface hierarchy, one-pixel dividers, sensible compact typography, selected/focus states and responsive collapse behavior. Do not restyle individual workspace internals in this task.
- [ ] **Step 6: Update localized labels** in EN/RU/ZH; no hard-coded Russian strings are introduced for new shell controls.
- [ ] **Step 7: Run** focused Playwright shell tests at 1280×720 and the existing app smoke suite.
- [ ] **Step 8: Commit** the shell composition and style changes.

### Task 5: Integrate and verify first delivery

**Files:**
- Modify only if test findings require a scoped correction: files from Tasks 1–4
- Test: `tests/e2e/app.spec.ts`, `tests/utils/appVersion.test.ts`, `tests/utils/fsmViewportCache.test.ts`

- [ ] **Step 1: Run** `npm run typecheck`.
- [ ] **Step 2: Run** focused Vitest: `npx vitest run tests/utils/appVersion.test.ts tests/utils/fsmViewportCache.test.ts`.
- [ ] **Step 3: Build renderer** with `npm run build:renderer`.
- [ ] **Step 4: Run** the app Playwright suite and inspect any unrelated pre-existing failures separately.
- [ ] **Step 5: Manually smoke-test** the September ECROS project: Open → FSM, manually pan/zoom, change to LCD and back, reload, Auto arrange, Save, Export.
- [ ] **Step 6: Confirm** project revision and exported `.lcdproj` remain unchanged by viewport-only actions.
- [ ] **Step 7: Commit** only necessary final fixes; do not stage unrelated user changes.

## Plan self-review

- **Spec coverage:** Tasks 1 and 4 cover separate software/project versions, grouped navigation, minimal layout and responsive action availability. Tasks 2 and 3 cover retained 2D viewport, context separation, safe cache failure, explicit auto-layout behavior and canvas mechanics. Task 5 verifies non-mutation and the ECROS workflow.
- **Scope:** HMI Designer, Handoff and Alarms remain follow-on deliveries as required by the specification.
- **Type consistency:** cache context and viewport interfaces are established in Task 2 and consumed verbatim in Task 3.
- **No placeholders:** all files, tests and success conditions are specified.

