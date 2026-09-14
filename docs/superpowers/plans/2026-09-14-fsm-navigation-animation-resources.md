# FSM Navigation and Animation Resources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Restore reliable FSM edge visibility, make navigation and FSM panes independently collapsible, and add editable 1bpp animation resources that render and export as timed firmware data.

**Architecture:** Persist animation resources in the project model and bind them either to screens or bitmap objects. Keep timing resolution, validation and C serialization pure and deterministic; make the LCD UI a client of those units. Separate shell navigator presentation from local FSM pane layout so each is independently controlled.

**Tech Stack:** TypeScript, React 19, Zustand, @xyflow/react, Vite, Vitest, Playwright.

**Spec:** \`docs/superpowers/specs/2026-09-14-fsm-navigation-animation-resources-design.md\`

## Global Constraints

- Preserve loading and export behavior for \`.lcdproj\` files with no animation fields.
- 1bpp bytes use the existing vertical-page packing and have deterministic ordering.
- Frame duration is an integer from 1 through 60,000 ms.
- Read-only FSM must render persisted transitions while leaving new connections disabled.
- Global navigator compaction must not hide local workspace sidebars.
- User-facing labels are provided in English, Russian and Chinese.

---

### Task 1: Define, migrate and validate animation project data

**Files:**
- Create: \`src/domain/animation.ts\`
- Modify: \`src/domain/project.ts\`, \`src/domain/canvas.ts\`, \`src/domain/index.ts\`, \`src/services/projectMigrationService.ts\`, \`src/services/projectValidationService.ts\`
- Test: \`tests/utils/animationModel.test.ts\`, \`tests/utils/projectMigrationV5.test.ts\`

**Interfaces:**
- Produces \`AnimationFrame\`, \`AnimationResource\`, \`AnimationCatalog\`, \`resolveAnimationFrame(resource, elapsedMs)\` and \`validateAnimationResource(resource)\`.
- \`LcdBitmapProject.animations\` is \`{ resources: Record<string, AnimationResource>; order: string[] }\`.
- \`LcdScreen.animationId?: string | null\`; \`BitmapCanvasObject.animationId?: string | null\`.

- [ ] **Step 1: Write the failing model and migration tests.**

\`\`\`ts
it('cycles a looping resource by cumulative frame durations', () => {
  const resource = fixtureAnimation({ loop: true, frames: [frame('a', 40), frame('b', 60)] });
  expect(resolveAnimationFrame(resource, 105)?.id).toBe('a');
});

it('migrates projects with no animation field to an empty catalog', () => {
  expect(migrateProject(legacyFixtureWithoutAnimations()).project.animations).toEqual({ resources: {}, order: [] });
});

it('removes a binding to a resource missing after migration', () => {
  expect(migrateProject(projectWithMissingAnimationBinding()).project.screens.screen.animationId).toBeNull();
});
\`\`\`

- [ ] **Step 2: Run tests to verify they fail.**

Run: \`npx vitest run tests/utils/animationModel.test.ts tests/utils/projectMigrationV5.test.ts\`

Expected: failure because animation types, resolver and migration fields do not exist.

- [ ] **Step 3: Add the focused domain model and normalizer.**

\`\`\`ts
export interface AnimationFrame { id: string; bytes: number[]; durationMs: number; }
export interface AnimationResource { id: string; name: string; width: number; height: number; loop: boolean; frames: AnimationFrame[]; }
export interface AnimationCatalog { resources: Record<string, AnimationResource>; order: string[]; }

export function resolveAnimationFrame(resource: AnimationResource, elapsedMs: number): AnimationFrame | null {
  if (!resource.frames.length) return null;
  const total = resource.frames.reduce((sum, frame) => sum + frame.durationMs, 0);
  let clock = resource.loop ? ((elapsedMs % total) + total) % total : Math.min(Math.max(0, elapsedMs), total - 1);
  return resource.frames.find((frame) => ((clock -= frame.durationMs) < 0)) ?? resource.frames.at(-1)!;
}
\`\`\`

Normalize missing catalogs to the empty catalog, retain only ordered existing ids, clamp duration to the stated range, and null binding ids which do not resolve.

- [ ] **Step 4: Run tests to verify they pass.**

Run: \`npx vitest run tests/utils/animationModel.test.ts tests/utils/projectMigrationV5.test.ts\`

Expected: PASS.

- [ ] **Step 5: Commit the isolated change.**

\`\`\`bash
git add src/domain src/services/projectMigrationService.ts src/services/projectValidationService.ts tests/utils/animationModel.test.ts tests/utils/projectMigrationV5.test.ts
git commit -m "feat: add animation resource model"
\`\`\`

### Task 2: Add undoable animation commands and bindings

**Files:**
- Modify: \`src/application/commandTypes.ts\`, \`src/application/projectMutations.ts\`, \`src/renderer/store/projectStore.ts\`
- Test: \`tests/utils/animationCommands.test.ts\`

**Interfaces:**
- Produces store actions \`createAnimation\`, \`updateAnimation\`, \`deleteAnimation\`, \`addAnimationFrame\`, \`updateAnimationFrame\`, \`removeAnimationFrame\`, \`reorderAnimationFrames\`, \`bindScreenAnimation\`, and \`bindBitmapAnimation\`.
- Every action routes through \`ProjectCommand\` and retains undo/redo behavior.

- [ ] **Step 1: Write failing command tests.**

\`\`\`ts
it('adds an animation frame as one undoable command', () => {
  const result = apply(projectWorkspace(), command('animation.frame.add', { animationId: 'spin', frame }));
  expect(result.workspace.project.animations.resources.spin.frames).toContainEqual(frame);
});

it('refuses a layer binding whose dimensions differ from its bitmap object', () => {
  expect(() => bindBitmapAnimation(project, 'screen', 'bitmap', 'wrong-size')).toThrow(/dimensions/i);
});
\`\`\`

- [ ] **Step 2: Run tests to verify they fail.**

Run: \`npx vitest run tests/utils/animationCommands.test.ts\`

Expected: failure because animation commands and mutation handlers do not exist.

- [ ] **Step 3: Implement command, mutation and store delegates.**

\`\`\`ts
export type AnimationFrameAddCommand = BaseProjectCommand<'animation.frame.add', { animationId: string; frame: AnimationFrame }>;
export type AnimationBindingSetCommand = BaseProjectCommand<'animation.binding.set', { screenId: string; objectId?: string; animationId: string | null }>;

function bindAnimation(workspace: ApplicationWorkspace, payload: AnimationBindingSetCommand['payload'], context: ApplicationCommandContext): ProjectMutationResult {
  const resource = payload.animationId ? workspace.project.animations.resources[payload.animationId] : null;
  const target = payload.objectId ? findBitmap(workspace.project, payload.screenId, payload.objectId) : workspace.project.screens[payload.screenId];
  if (!target || (resource && (resource.width !== target.width || resource.height !== target.height))) return noChange(workspace);
  return updateBinding(workspace, payload, context);
}
\`\`\`

Include all literals in \`PROJECT_COMMAND_TYPES\`; return validation issues for invalid assignment and null bindings when deleting a resource.

- [ ] **Step 4: Run tests to verify they pass.**

Run: \`npx vitest run tests/utils/animationCommands.test.ts\`

Expected: PASS.

- [ ] **Step 5: Commit the isolated change.**

\`\`\`bash
git add src/application src/renderer/store/projectStore.ts tests/utils/animationCommands.test.ts
git commit -m "feat: add animation editing commands"
\`\`\`

### Task 3: Render bound animation frames deterministically

**Files:**
- Create: \`src/renderer/core/animationRenderer.ts\`
- Modify: \`src/renderer/utils/render.ts\`, \`src/renderer/components/LCDCanvas.tsx\`
- Test: \`tests/utils/animationRenderer.test.ts\`, \`tests/utils/render.test.ts\`

**Interfaces:**
- \`renderScreenAt(project, screenId, options, elapsedMs): FrameBuffer\` renders full-screen or bitmap bindings.
- \`LCDCanvas\` receives optional \`animationCatalog\` and \`elapsedMs\` without altering static callers.

- [ ] **Step 1: Write failing rendering tests.**

\`\`\`ts
it('uses the active layer frame while preserving static pixels', () => {
  const rendered = renderScreenAt(projectWithLayerAnimation(), 'screen', {}, 60);
  expect(rendered[2][2]).toBe(true);
  expect(rendered[0][0]).toBe(true);
});

it('uses a full-screen frame instead of static content', () => {
  expect(renderScreenAt(projectWithScreenAnimation(), 'screen', {}, 0)).toEqual(frameBufferFor('frame-a'));
});
\`\`\`

- [ ] **Step 2: Run tests to verify they fail.**

Run: \`npx vitest run tests/utils/animationRenderer.test.ts tests/utils/render.test.ts\`

Expected: failure because no animation-aware screen renderer exists.

- [ ] **Step 3: Implement resolution and compositing without mutating project data.**

\`\`\`ts
export function bytesForBitmap(object: BitmapCanvasObject, catalog: AnimationCatalog, elapsedMs: number): number[] {
  const resource = object.animationId ? catalog.resources[object.animationId] : null;
  return resource && resource.width === object.width && resource.height === object.height
    ? resolveAnimationFrame(resource, elapsedMs)?.bytes ?? object.bytes
    : object.bytes;
}
\`\`\`

For full-screen bindings unpack only the active resource frame. For layer bindings clone the object with resolved bytes before using the existing bitmap draw path.

- [ ] **Step 4: Run tests to verify they pass.**

Run: \`npx vitest run tests/utils/animationRenderer.test.ts tests/utils/render.test.ts\`

Expected: PASS.

- [ ] **Step 5: Commit the isolated change.**

\`\`\`bash
git add src/renderer/core src/renderer/utils/render.ts src/renderer/components/LCDCanvas.tsx tests/utils/animationRenderer.test.ts tests/utils/render.test.ts
git commit -m "feat: render animation bindings"
\`\`\`

### Task 4: Export timed animation arrays and bindings

**Files:**
- Create: \`src/compiler/animation/animationCodegen.ts\`
- Modify: \`src/compiler/target-ir/targetIr.ts\`, \`src/compiler/lowering/lowerToTargetIr.ts\`, \`src/compiler/backends/legacyCBackend.ts\`, \`src/compiler/index.ts\`
- Test: \`tests/utils/animationCodegen.test.ts\`, \`tests/utils/codegen.test.ts\`

**Interfaces:**
- \`LoweredTargetIrV1.animations\` carries ordered resources and screen/object bindings.
- \`generateAnimationCHeader(animations, baseName, bytesPerRow)\` produces arrays, \`lcd_animation_frame_t\`, \`lcd_animation_t\`, resources and binding metadata.

- [ ] **Step 1: Write failing export tests.**

\`\`\`ts
it('exports ordered frame arrays and duration metadata', () => {
  const header = compileLegacyCodegen(animationInput()).artifacts.artifacts[0].text;
  expect(header).toContain('typedef struct { const uint8_t *bytes; uint32_t byte_count; uint32_t duration_ms; } lcd_animation_frame_t;');
  expect(header).toContain('{ project_spinner_frame_0, 16, 120 }');
});

it('keeps static-project legacy C output unchanged', () => {
  expect(compileLegacyCodegen(staticInput()).artifacts).toEqual(loadStaticCodegenFixture());
});
\`\`\`

- [ ] **Step 2: Run tests to verify they fail.**

Run: \`npx vitest run tests/utils/animationCodegen.test.ts tests/utils/codegen.test.ts\`

Expected: failure because target IR and C backend do not serialize animations.

- [ ] **Step 3: Lower and serialize animation data.**

\`\`\`ts
export function generateAnimationCHeader(resources: readonly LoweredAnimationIr[], baseName: string, bytesPerRow: number): string {
  return resources.flatMap((resource) => [
    ...resource.frames.map((frame, index) => generateCArray(\`\${baseName}_\${resource.symbol}_frame_\${index}\`, frame.bytes, bytesPerRow)),
    \`static const lcd_animation_frame_t \${baseName}_\${resource.symbol}_frames[] = { \${resource.frames.map((frame, index) => \`{ \${baseName}_\${resource.symbol}_frame_\${index}, \${frame.bytes.length}, \${frame.durationMs} }\`).join(', ')} };\`,
    \`static const lcd_animation_t \${baseName}_\${resource.symbol} = { \${baseName}_\${resource.symbol}_frames, \${resource.frames.length}, \${resource.loop ? 'true' : 'false'} };\`
  ]).join('\\n\\n');
}
\`\`\`

Emit the section only if resources exist, include \`<stdbool.h>\`, and serialize binding identifiers in persisted order.

- [ ] **Step 4: Run tests to verify they pass.**

Run: \`npx vitest run tests/utils/animationCodegen.test.ts tests/utils/codegen.test.ts\`

Expected: PASS.

- [ ] **Step 5: Commit the isolated change.**

\`\`\`bash
git add src/compiler tests/utils/animationCodegen.test.ts tests/utils/codegen.test.ts
git commit -m "feat: export timed animation resources"
\`\`\`

### Task 5: Repair FSM transition rendering and expose filtering

**Files:**
- Modify: \`src/renderer/components/StateNode.tsx\`, \`src/features/fsm/FsmWorkspace.tsx\`, \`src/renderer/config/i18n.ts\`, \`src/renderer/styles.css\`
- Test: \`tests/e2e/app.spec.ts\`

**Interfaces:**
- \`StateNode\` always mounts stable \`s-*\` and \`t-*\` handles.
- \`FsmWorkspace\` exposes \`[data-testid="fsm-transition-summary"]\` and \`[data-testid="fsm-reset-graph-filters"]\`.

- [ ] **Step 1: Write failing browser regression tests.**

\`\`\`ts
test('renders persisted FSM edges in read-only mode', async ({ page }) => {
  await openDemoAndFsm(page);
  await expect(page.getByTestId('fsm-edit-mode')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.react-flow__edge path.fsm-edge')).toHaveCount(4);
});

test('reports and resets transitions hidden by overview', async ({ page }) => {
  await openDemoAndFsm(page);
  await page.getByRole('button', { name: /Overview|Обзор/ }).click();
  await expect(page.getByTestId('fsm-transition-summary')).toContainText(/of 4/);
  await page.getByTestId('fsm-reset-graph-filters').click();
  await expect(page.getByTestId('fsm-transition-summary')).toContainText('4 / 4');
});
\`\`\`

- [ ] **Step 2: Run tests to verify they fail.**

Run: \`npx playwright test --config playwright.dev.config.ts tests/e2e/app.spec.ts --grep "persisted FSM edges|resets transitions"\`

Expected: edge count is zero in read-only mode because named handles are absent.

- [ ] **Step 3: Mount passive handles and add graph summary controls.**

\`\`\`tsx
<div className={editingEnabled ? 'node-handles' : 'node-handles node-handles-passive'} aria-hidden={!editingEnabled}>
  <Handle type="target" position={Position.Right} id="t-right" />
  <Handle type="source" position={Position.Right} id="s-right" />
</div>
\`\`\`

Mount the six remaining stable handles in the same wrapper. Use \`pointer-events: none\` and opacity suppression for passive handles; leave \`nodesConnectable={editing}\`. Derive hidden count from all transitions minus \`canvasTransitions\`, present its active reason, and reset layers, subsystem focus and overview together.

- [ ] **Step 4: Run tests to verify they pass.**

Run: \`npx playwright test --config playwright.dev.config.ts tests/e2e/app.spec.ts --grep "persisted FSM edges|resets transitions"\`

Expected: PASS with four edges in demo read-only mode.

- [ ] **Step 5: Commit the isolated change.**

\`\`\`bash
git add src/renderer/components/StateNode.tsx src/features/fsm/FsmWorkspace.tsx src/renderer/config/i18n.ts src/renderer/styles.css tests/e2e/app.spec.ts
git commit -m "fix: render FSM transitions outside edit mode"
\`\`\`

### Task 6: Separate global navigator compaction from local FSM panes

**Files:**
- Modify: \`src/renderer/App.tsx\`, \`src/renderer/config/i18n.ts\`, \`src/renderer/styles.css\`, \`src/features/fsm/FsmWorkspace.tsx\`
- Test: \`tests/utils/workspaceNavigatorPreference.test.ts\`, \`tests/e2e/app.spec.ts\`

**Interfaces:**
- Global action is localized as \`Collapse navigator\` / \`Свернуть навигатор\` and only changes shell presentation.
- FSM persisted layout gains \`leftCollapsed\` and \`rightCollapsed\`; collapsed rails are 46px.

- [ ] **Step 1: Write failing e2e tests.**

\`\`\`ts
test('navigator compaction leaves FSM state pane visible', async ({ page }) => {
  await openDemoAndFsm(page);
  await page.getByTestId('workspace-navigator-toggle').click();
  await expect(page.locator('.fsm-state-catalog')).toBeVisible();
});

test('FSM pane collapse releases its grid column and remains restorable', async ({ page }) => {
  await openDemoAndFsm(page);
  await page.getByTestId('fsm-collapse-state-catalog').click();
  await expect(page.locator('.fsm-state-catalog')).toHaveClass(/collapsed/);
  await expect(page.getByTestId('fsm-expand-state-catalog')).toBeVisible();
});
\`\`\`

- [ ] **Step 2: Run tests to verify they fail.**

Run: \`npx vitest run tests/utils/workspaceNavigatorPreference.test.ts && npx playwright test --config playwright.dev.config.ts tests/e2e/app.spec.ts --grep "navigator compaction|FSM pane collapse"\`

Expected: global compact CSS hides \`.workspace-sidebar\`; local FSM collapse controls do not exist.

- [ ] **Step 3: Implement independent controls and grid tracks.**

\`\`\`tsx
style={{ gridTemplateColumns: \`\${layout.leftCollapsed ? 46 : layout.leftWidth}px 6px minmax(430px, 1fr) 6px \${layout.rightCollapsed ? 46 : layout.rightWidth}px\` }}
\`\`\`

Remove workspace-sidebar selectors from \`.navigator-compact\`. Add a visible rail button to every collapsed FSM aside; disable its splitter pointer-down while collapsed; persist flags under the existing FSM layout key.

- [ ] **Step 4: Run tests to verify they pass.**

Run: \`npx vitest run tests/utils/workspaceNavigatorPreference.test.ts && npx playwright test --config playwright.dev.config.ts tests/e2e/app.spec.ts --grep "navigator compaction|FSM pane collapse"\`

Expected: PASS.

- [ ] **Step 5: Commit the isolated change.**

\`\`\`bash
git add src/renderer/App.tsx src/renderer/config/i18n.ts src/renderer/styles.css src/features/fsm/FsmWorkspace.tsx tests/utils/workspaceNavigatorPreference.test.ts tests/e2e/app.spec.ts
git commit -m "fix: separate navigator and FSM pane collapse"
\`\`\`

### Task 7: Improve raster placement and animation authoring

**Files:**
- Create: \`src/features/animation-editor/AnimationEditor.tsx\`
- Modify: \`src/features/pixel-importer/PixelImporter.tsx\`, \`src/features/pixel-importer/imageProcessor.ts\`, \`src/features/lcd/LcdWorkspace.tsx\`, \`src/renderer/config/i18n.ts\`, \`src/renderer/styles.css\`
- Test: \`tests/utils/pixelImporterPlacement.test.ts\`, \`tests/e2e/app.spec.ts\`

**Interfaces:**
- \`PixelImporter\` accepts \`onPreparedBytes(bytes, { width, height, x, y })\`.
- \`AnimationEditor\` accepts catalog, current screen/object and command callbacks.

- [ ] **Step 1: Write failing import and authoring tests.**

\`\`\`ts
test('insert and edit selects the imported bitmap before returning to editor', async ({ page }) => {
  await openDemoAndLcd(page);
  await importFixture(page, 'two-pixel.png');
  await page.getByRole('button', { name: /Insert and edit bitmap|Вставить и редактировать bitmap/ }).click();
  await expect(page.locator('[data-testid="selected-canvas-object"]')).toHaveText(/pixel-import/);
});

test('animation editor previews and binds a matching bitmap resource', async ({ page }) => {
  await openDemoAndLcd(page);
  await page.getByRole('button', { name: /Animations|Анимации/ }).click();
  await expect(page.getByTestId('animation-preview')).toBeVisible();
});
\`\`\`

- [ ] **Step 2: Run tests to verify they fail.**

Run: \`npx vitest run tests/utils/pixelImporterPlacement.test.ts && npx playwright test --config playwright.dev.config.ts tests/e2e/app.spec.ts --grep "insert and edit selects|animation editor previews"\`

Expected: no placement mode or animation editor exists.

- [ ] **Step 3: Implement importer placement and editor.**

\`\`\`tsx
<AnimationEditor
  catalog={project.animations}
  selectedScreen={screen}
  selectedBitmap={selectedBitmap}
  onAddFrame={(animationId, bytes) => addAnimationFrame(animationId, { id: createId(), bytes, durationMs: 120 })}
  onBindScreen={(animationId) => bindScreenAnimation(screen.id, animationId)}
  onBindBitmap={(animationId) => bindBitmapAnimation(screen.id, selectedBitmap.id, animationId)}
/>
\`\`\`

Reuse the single worker conversion path and file-size validation. Add fit mode \`contain|stretch\`, constrained x/y placement, frame add/duplicate/remove/reorder/duration controls, loop checkbox, play/pause/replay/scrubber and frame rendering driven by \`requestAnimationFrame\`.

- [ ] **Step 4: Run tests to verify they pass.**

Run: \`npx vitest run tests/utils/pixelImporterPlacement.test.ts && npx playwright test --config playwright.dev.config.ts tests/e2e/app.spec.ts --grep "insert and edit selects|animation editor previews"\`

Expected: PASS with no console errors.

- [ ] **Step 5: Commit the isolated change.**

\`\`\`bash
git add src/features/animation-editor src/features/pixel-importer src/features/lcd/LcdWorkspace.tsx src/renderer/config/i18n.ts src/renderer/styles.css tests/utils/pixelImporterPlacement.test.ts tests/e2e/app.spec.ts
git commit -m "feat: author exportable LCD animations"
\`\`\`

### Task 8: Verify the user workflow and document it

**Files:**
- Modify: \`README.md\`, \`src/renderer/config/operationManual.ts\`
- Test: \`tests/e2e/app.spec.ts\`, \`tests/utils/animationModel.test.ts\`, \`tests/utils/animationCommands.test.ts\`, \`tests/utils/animationRenderer.test.ts\`, \`tests/utils/animationCodegen.test.ts\`

**Interfaces:**
- Documentation names the import-to-animation workflow, firmware contract and read-only FSM graph behavior.

- [ ] **Step 1: Write the final export acceptance assertion.**

\`\`\`ts
it('exports documented timing and binding metadata', () => {
  const header = generatedAnimationHeader();
  expect(header).toContain('lcd_animation_t');
  expect(header).toContain('duration_ms');
});
\`\`\`

- [ ] **Step 2: Run the assertion before finalizing.**

Run: \`npx vitest run tests/utils/animationCodegen.test.ts --reporter=verbose\`

Expected: PASS after Task 4; it is the regression guard for the public export contract.

- [ ] **Step 3: Document completed workflows.**

Add concise manual sections for raster import, editing imported pixels, creating timed frames, assigning screen/layer animation, previewing, and using \`lcd_animation_t\` in firmware. State that countdown values should use runtime-tag text.

- [ ] **Step 4: Run focused verification.**

Run: \`npx vitest run tests/utils/animationModel.test.ts tests/utils/animationCommands.test.ts tests/utils/animationRenderer.test.ts tests/utils/animationCodegen.test.ts tests/utils/projectMigrationV5.test.ts tests/utils/workspaceNavigatorPreference.test.ts && npx playwright test --config playwright.dev.config.ts tests/e2e/app.spec.ts\`

Expected: PASS with no test failures.

- [ ] **Step 5: Run production verification.**

Run: \`npm run typecheck && npm run build\`

Expected: both commands exit 0.

- [ ] **Step 6: Commit documentation and final verification changes.**

\`\`\`bash
git add README.md src/renderer/config/operationManual.ts tests
git commit -m "docs: describe FSM and animation workflows"
\`\`\`

