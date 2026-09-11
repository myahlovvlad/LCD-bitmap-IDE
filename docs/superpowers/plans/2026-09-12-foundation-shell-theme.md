# Foundation Shell and System Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the stable grouped IDE shell, system/light/dark theme preference, global Settings access, software-version identity and retained FSM canvas viewport without changing project data or `.lcdproj` output.

**Architecture:** Keep `WorkspaceMode`, `WorkspaceRouter`, project stores and existing workspace components intact. Add a small renderer-only theme preference boundary, compose the existing routes through the grouped shell in `App.tsx`, and keep viewport/theme/navigation presentation state outside the project model. Convert shell colors to semantic CSS tokens so both resolved themes use the same component markup.

**Tech Stack:** React 19, TypeScript, Vite, Electron/Tauri renderer, CSS custom properties, `@xyflow/react`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-12-full-workspace-ia-and-themes-design.md`

## Global Constraints

- Preserve `.lcdproj` schema, project revision semantics, existing route modes and MCP command names.
- Theme preference is exactly `'system' | 'light' | 'dark'` and defaults to `system`.
- The resolved theme follows `prefers-color-scheme` only while preference is `system`.
- Theme, navigator and FSM viewport state are UI-only and never update project data.
- The simulated LCD retains its device palette in both application themes.
- Software version and project/schema version remain visibly separate.
- Preserve every existing workspace and the user's uncommitted changes; stage only files belonging to an individual task.

---

### Task 1: Theme preference boundary

**Files:**
- Create: `src/renderer/theme/themePreference.ts`
- Test: `tests/utils/themePreference.test.ts`

**Interfaces:**
- Produces: `ThemePreference = 'system' | 'light' | 'dark'`.
- Produces: `ResolvedTheme = 'light' | 'dark'`.
- Produces: `THEME_PREFERENCE_STORAGE_KEY`.
- Produces: `normalizeThemePreference(value: unknown): ThemePreference`.
- Produces: `resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme`.
- Produces: `readThemePreference(storage?: StorageLike): ThemePreference` and `writeThemePreference(preference, storage?)` with guarded storage access.

- [ ] **Step 1: Write the failing unit tests**

```ts
expect(normalizeThemePreference(undefined)).toBe('system');
expect(normalizeThemePreference('light')).toBe('light');
expect(normalizeThemePreference('unknown')).toBe('system');
expect(resolveTheme('system', true)).toBe('dark');
expect(resolveTheme('system', false)).toBe('light');
expect(resolveTheme('dark', false)).toBe('dark');
expect(readThemePreference(memoryStorage('{}'))).toBe('system');
```

Include tests that a throwing `getItem` or `setItem` does not escape and that an explicit preference round-trips.

- [ ] **Step 2: Run the test to verify the red state**

Run: `npx vitest run tests/utils/themePreference.test.ts`

Expected: FAIL because `src/renderer/theme/themePreference.ts` does not exist.

- [ ] **Step 3: Implement the pure preference module**

Use a versioned local-storage key, validate all external values and avoid importing the project store. `writeThemePreference` returns `false` on storage failure and `true` on success.

- [ ] **Step 4: Run the focused test and typecheck**

Run: `npx vitest run tests/utils/themePreference.test.ts`

Expected: all tests PASS.

Run: `npm run typecheck`

Expected: exit code 0.

- [ ] **Step 5: Commit only the theme boundary**

```powershell
git add -- src/renderer/theme/themePreference.ts tests/utils/themePreference.test.ts
git commit -m "feat: add renderer theme preference"
```

### Task 2: Reactive system theme and global selector

**Files:**
- Create: `src/renderer/theme/useAppTheme.ts`
- Create: `src/renderer/theme/ThemeSelector.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/features/settings/SettingsWorkspace.tsx`
- Modify: `src/renderer/config/i18n.ts`
- Test: `tests/utils/themePreference.test.ts`
- Test: `tests/e2e/app.spec.ts`

**Interfaces:**
- Consumes: theme contracts from Task 1.
- Produces: `useAppTheme(): { preference; resolvedTheme; setPreference }`.
- Produces: `<ThemeSelector preference onChange labels />` with three explicit options.
- Side effect: sets `document.documentElement.dataset.theme` to the resolved theme and `colorScheme` accordingly.

- [ ] **Step 1: Add failing browser coverage for the theme selector**

Add tests that clear the theme key, emulate dark system color scheme, reload, and expect the root to have `data-theme="dark"`; selecting light must set `data-theme="light"` and persist `light` after reload.

Use stable selectors `data-testid="theme-selector"` and option values `system`, `light`, `dark`.

- [ ] **Step 2: Run the focused browser test to verify the red state**

Run: `npm run build:renderer`

Run: `npx playwright test --config playwright.config.ts tests/e2e/app.spec.ts --grep "theme preference"`

Expected: FAIL because the selector and root theme state are absent.

- [ ] **Step 3: Implement `useAppTheme`**

Initialize from `readThemePreference()`, subscribe to
`matchMedia('(prefers-color-scheme: dark)')`, update the document root in a
layout effect, and unsubscribe on unmount. A manual light/dark preference must
ignore later media-query changes until the preference returns to `system`.

- [ ] **Step 4: Add the compact selector to the header and Settings**

The header selector is always reachable. Settings exposes the same preference
with explanatory localized text. Both controls use the same hook-owned state
passed from `App`, so they cannot disagree.

- [ ] **Step 5: Add RU/EN/ZH labels**

Add labels for `Theme`, `System`, `Light`, `Dark` and the system-following
description to the existing `UiText` contract and all three language objects.

- [ ] **Step 6: Run focused tests and typecheck**

Run: `npx vitest run tests/utils/themePreference.test.ts`

Run: `npm run typecheck`

Run: `npm run build:renderer`

Run: `npx playwright test --config playwright.config.ts tests/e2e/app.spec.ts --grep "theme preference"`

Expected: all focused checks PASS.

- [ ] **Step 7: Commit the reactive theme integration**

```powershell
git add -- src/renderer/theme/useAppTheme.ts src/renderer/theme/ThemeSelector.tsx src/renderer/App.tsx src/features/settings/SettingsWorkspace.tsx src/renderer/config/i18n.ts tests/e2e/app.spec.ts tests/utils/themePreference.test.ts
git commit -m "feat: add system-aware IDE themes"
```

### Task 3: Complete grouped shell and route coherence

**Files:**
- Create: `src/renderer/navigation/workspaceGroups.ts`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/config/i18n.ts`
- Modify: `tests/e2e/app.spec.ts`
- Modify: `tests/e2e/pages/FsmWorkspacePage.ts`

**Interfaces:**
- Produces: `WorkspaceGroupId = 'interface' | 'logic' | 'hardware' | 'delivery'`.
- Produces: `WORKSPACE_GROUPS` with every non-settings `WorkspaceMode` exactly once.
- Produces: `groupForWorkspace(mode: WorkspaceMode): WorkspaceGroupId`.
- Route rule: changing route synchronizes the selected group; group selection alone does not mutate the route or project.

- [ ] **Step 1: Add failing tests for the route map**

Cover these facts in `app.spec.ts`: each activity button exposes only its
assigned workspace buttons; Settings opens from the header; direct navigation
to a workspace synchronizes the correct group; switching every route leaves
the saved project revision unchanged.

Add a small Playwright navigation helper that first selects the containing
activity group before clicking an existing `workspace-*` button. Replace old
tests that click a hidden workspace button directly.

- [ ] **Step 2: Run focused shell tests to observe current failures**

Run: `npm run build:renderer`

Run: `npx playwright test --config playwright.config.ts tests/e2e/app.spec.ts --grep "primary isolated|workspace group|Settings"`

Expected: at least Settings reachability or hidden-workspace navigation FAILS.

- [ ] **Step 3: Extract and validate the group map**

Move the mapping and `groupForWorkspace` out of `App.tsx`. Add a development
assertion or unit-shaped runtime guard that reports duplicate/missing route
members without affecting production project data. Keep existing route mode
strings and deep links unchanged.

- [ ] **Step 4: Complete the header and navigator behavior**

Restore a global Settings button, keep Open/Save/Export visible at desktop
width, keep Software and Project/schema badges distinct, and make the active
group update whenever `location.mode` changes. The settings route retains the
previous group so Back returns to a predictable editor context.

- [ ] **Step 5: Localize all new group and control labels**

Remove hard-coded per-language records from the shell and source labels from
`UiText`. Maintain accessible names and `aria-current`/selected state.

- [ ] **Step 6: Run the shell tests, typecheck and build**

Run: `npm run typecheck`

Run: `npm run build:renderer`

Run: `npx playwright test --config playwright.config.ts tests/e2e/app.spec.ts --grep "primary isolated|workspace group|Settings|software version"`

Expected: all focused checks PASS.

- [ ] **Step 7: Commit the completed shell navigation**

```powershell
git add -- src/renderer/navigation/workspaceGroups.ts src/renderer/App.tsx src/renderer/config/i18n.ts tests/e2e/app.spec.ts tests/e2e/pages/FsmWorkspacePage.ts
git commit -m "feat: complete grouped IDE navigation"
```

### Task 4: Semantic light and dark visual foundation

**Files:**
- Modify: `src/renderer/styles.css`
- Modify: `tests/e2e/app.spec.ts`

**Interfaces:**
- Consumes: root `data-theme` from Task 2.
- Produces: semantic CSS variables for background, surfaces, borders, text,
  primary, focus, success, warning and danger.
- Preserves: dedicated `.lcd-*` rendering colors and bitmap contrast.

- [ ] **Step 1: Add theme visual-contract assertions**

For each resolved theme, assert non-empty and different computed values for
the page surface and primary text tokens, visible focus outline on an activity
button, and unchanged computed LCD display foreground/background values.

- [ ] **Step 2: Run the focused tests to verify the red state**

Run: `npm run build:renderer`

Run: `npx playwright test --config playwright.config.ts tests/e2e/app.spec.ts --grep "theme visual foundation"`

Expected: FAIL because the light semantic token set is absent.

- [ ] **Step 3: Define the semantic token sets**

Define dark defaults on `:root` and light overrides on
`:root[data-theme='light']`. Use tokens for all shell surfaces and controls.
Keep warnings and validation readable through text plus icon/border, never
color alone.

- [ ] **Step 4: Recompose the shell CSS**

Make the shell a single compact header, activity bar, navigator, work area and
status bar. Remove duplicate shell borders/card styling, preserve collapse
behavior, and add keyboard focus-visible styles. At 1280 x 720 the work area
must retain at least 680 px width.

- [ ] **Step 5: Verify the visual foundation**

Run: `npm run typecheck`

Run: `npm run build:renderer`

Run: `npx playwright test --config playwright.config.ts tests/e2e/app.spec.ts --grep "theme visual foundation|primary isolated"`

Expected: all focused checks PASS and no browser console errors.

- [ ] **Step 6: Commit the tokenized shell styling**

```powershell
git add -- src/renderer/styles.css tests/e2e/app.spec.ts
git commit -m "feat: add light and dark visual foundation"
```

### Task 5: Finish retained FSM viewport and foundation regression

**Files:**
- Modify: `src/features/fsm/fsmViewportCache.ts`
- Modify: `src/features/fsm/FsmWorkspace.tsx`
- Modify: `tests/utils/fsmViewportCache.test.ts`
- Modify: `tests/e2e/app.spec.ts`
- Modify: `tests/e2e/pages/FsmWorkspacePage.ts`

**Interfaces:**
- Consumes: grouped route helper from Task 3.
- Preserves: existing `FsmViewport`, `FsmViewportContext` and cache key.
- Rule: cache key includes project ID and graph representation; cache writes do not call any project mutation.

- [ ] **Step 1: Audit existing partial viewport implementation against tests**

Confirm unit coverage for malformed storage, independent representations and
reload persistence. Add a failing Playwright reload test in addition to the
existing FSM -> LCD -> FSM test. Record project revision before viewport
actions and assert it remains unchanged.

- [ ] **Step 2: Run focused viewport tests and capture the failing path**

Run: `npx vitest run tests/utils/fsmViewportCache.test.ts`

Run: `npm run build:renderer`

Run: `npx playwright test --config playwright.config.ts tests/e2e/app.spec.ts --grep "operator zoom|viewport reload"`

Expected: cache tests pass or expose a scoped cache issue; reload coverage must
fail until restoration is complete.

- [ ] **Step 3: Correct restoration and fit behavior**

Restore a cached viewport on flow initialization and representation change.
Call `fitView` only when that representation has no valid cache entry or after
explicit auto-layout. Persist the final viewport from `onMoveEnd`. Ordinary
selection, node drag, rerender and workspace return must not reset it.

- [ ] **Step 4: Run foundation verification**

Run: `npx vitest run tests/utils/appVersion.test.ts tests/utils/themePreference.test.ts tests/utils/fsmViewportCache.test.ts`

Run: `npm run typecheck`

Run: `npm run build:renderer`

Run: `npx playwright test --config playwright.config.ts tests/e2e/app.spec.ts`

Expected: focused unit tests, renderer typecheck/build and the complete app
spec PASS. If unrelated repository tests fail, record them separately and do
not hide them.

- [ ] **Step 5: Manually smoke-test the September project**

Open `ECROS-5400UV/ECROS-5400UV_FSM_11-09-2026.lcdproj`; switch system/light/
dark; open Settings; visit all activity groups; pan/zoom FSM, switch to LCD and
back, reload, and use Auto-layout. Save/export comparison must show no project
change caused solely by UI preference or viewport operations.

- [ ] **Step 6: Commit only scoped viewport corrections**

```powershell
git add -- src/features/fsm/fsmViewportCache.ts src/features/fsm/FsmWorkspace.tsx tests/utils/fsmViewportCache.test.ts tests/e2e/app.spec.ts tests/e2e/pages/FsmWorkspacePage.ts
git commit -m "fix: retain FSM viewport across workspace sessions"
```

## Plan self-review

- **Spec coverage:** Tasks 1-2 implement system/manual themes and persistence;
  Tasks 3-4 implement the global shell, Settings and semantic visual system;
  Task 5 completes viewport retention and non-mutation verification. Version
  separation is covered by existing version code plus Tasks 3 and 5 tests.
- **Scope:** This plan intentionally covers delivery 1 only. Editor IA and
  HMI/delivery workflows remain separately testable plans after this foundation
  passes, matching the approved three-delivery specification.
- **Type consistency:** Task 1 defines the exact theme types consumed by Task 2;
  Task 3 defines the group mapping consumed by Task 5 tests; Task 4 consumes
  only the root `data-theme` contract from Task 2.
- **No placeholders:** Every task lists exact files, interfaces, test commands,
  expected states and scoped commit commands.
