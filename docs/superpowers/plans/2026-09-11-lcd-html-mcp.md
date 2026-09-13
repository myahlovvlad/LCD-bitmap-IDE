# LCD HTML MCP Interchange Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic bidirectional LCD-screen HTML conversion and expose export, preview, apply, and 128×64 analysis through the shared MCP registry.

**Architecture:** The `screen-html` module converts the existing Screen Interchange representation to a restricted, declarative HTML document and back to a canonical Screen DSL document. Renderer automation owns MCP endpoints and delegates import preview/apply to the existing Screen DSL transaction flow; it never mutates Zustand directly.

**Tech Stack:** TypeScript, Zod, existing Screen Interchange / Screen DSL, Vitest, Electron and Tauri shared automation registry.

**Spec:** `docs/superpowers/specs/2026-09-11-lcd-html-mcp-design.md`

## Global Constraints

- The project and Screen DSL remain the source of truth; HTML is a lossless interchange view.
- Supported ECROS screens use explicit 128×64 integer coordinates; do not auto-resize or clip imported objects.
- Reject scripts, event attributes, external URLs, unknown LCD tags, CSS-derived geometry and documents exceeding 512 KiB.
- All writes require `expectedRevision`, run through the existing preview/apply transaction path, and remain undoable.
- No new runtime dependencies; parser/serializer must be deterministic and testable in Node.

---

### Task 1: Define and test the restricted LCD HTML interchange module

**Files:**
- Create: `src/screen-html/model.ts`
- Create: `src/screen-html/serialize.ts`
- Create: `src/screen-html/parse.ts`
- Create: `src/screen-html/index.ts`
- Test: `tests/utils/screenHtmlInterchange.test.ts`

**Interfaces:**
- Consumes: `ScreenInterchangeProjectV1`, `screenInterchangeToDslDocument`, and `ScreenDslDiagnostic`.
- Produces: `screenInterchangeToHtml(packageV1): string` and `htmlToScreenDslDocument(source, basePackage): { document, diagnostics }`.

- [ ] **Step 1: Write failing round-trip and rejection tests**

```ts
it('round-trips a 128×64 screen through canonical HTML without changing its pixels', () => {
  const html = screenInterchangeToHtml(fixturePackage);
  const parsed = htmlToScreenDslDocument(html, fixturePackage);
  expect(parsed.diagnostics).toEqual([]);
  expect(parsed.document?.screens[0].objects).toEqual(expectedDsl.screens[0].objects);
});

it('rejects executable and non-declarative HTML', () => {
  const parsed = htmlToScreenDslDocument('<section data-lcd-format="lcd-bitmap-ide/html" data-lcd-version="1"><script>alert(1)</script></section>', fixturePackage);
  expect(parsed.diagnostics).toEqual(expect.arrayContaining([
    expect.objectContaining({ code: 'SCREEN_HTML_FORBIDDEN_ELEMENT', severity: 'error' })
  ]));
});
```

- [ ] **Step 2: Run the tests to confirm they fail because the module is absent**

Run: `npx vitest run tests/utils/screenHtmlInterchange.test.ts --reporter=verbose`

Expected: import/module resolution failure for `src/screen-html`.

- [ ] **Step 3: Implement the canonical serializer**

Define constants `SCREEN_HTML_FORMAT = 'lcd-bitmap-ide/html'`, `SCREEN_HTML_VERSION = 1`, `MAX_SCREEN_HTML_BYTES = 512 * 1024`, and an allowed element set. Emit one root `<section>` with `data-lcd-screen-id`, `data-lcd-width`, `data-lcd-height` and one LCD custom element per canonical object. Include all canvas fields as individual `data-lcd-*` attributes, encode byte arrays and glyph overrides as base64 JSON, and HTML-escape every attribute value.

- [ ] **Step 4: Implement the non-executing parser and conversion**

Use a small tokenizer/attribute parser with no DOM execution. Enforce exactly one LCD root, allowed tag names and attribute names, integer geometry, unique object IDs, and no source larger than `MAX_SCREEN_HTML_BYTES`. Build a copied Screen Interchange package from the supplied base package, replace the target screen objects/resources, convert it through `screenInterchangeToDslDocument`, then reuse `validateScreenDslDocument` and `validateScreenDslPixelBudget` for final diagnostics.

- [ ] **Step 5: Run the module tests**

Run: `npx vitest run tests/utils/screenHtmlInterchange.test.ts --reporter=verbose`

Expected: PASS, including text, line, rectangle, icon, bitmap, special and invert fixtures, deterministic serialization, forbidden HTML, invalid geometry and size-limit tests.

### Task 2: Connect HTML import/export to the existing preview/apply transaction flow

**Files:**
- Create: `src/application/screenHtml/contracts.ts`
- Create: `src/application/screenHtml/createPreview.ts`
- Modify: `src/application/index.ts`
- Test: `tests/utils/screenHtmlPreview.test.ts`

**Interfaces:**
- Consumes: `htmlToScreenDslDocument`, `createScreenDslPreview`, `applyScreenDslPreview`, and `ProjectSession`.
- Produces: `createScreenHtmlPreview(session, request)` whose output contains `ScreenDslPreviewResult` plus canonical HTML.

- [ ] **Step 1: Write a failing non-mutating preview test**

```ts
it('previews HTML screen import without changing project revision', () => {
  const preview = createScreenHtmlPreview(session, { html, importMode: 'update', expectedRevision: session.revision });
  expect(preview.success).toBe(true);
  expect(session.revision).toBe(0);
  expect(preview.screenDslPreview.applyAllowed).toBe(true);
});
```

- [ ] **Step 2: Run the preview test and confirm it fails**

Run: `npx vitest run tests/utils/screenHtmlPreview.test.ts --reporter=verbose`

Expected: module/function missing.

- [ ] **Step 3: Implement the HTML preview facade**

Export current session screens as Screen Interchange, parse the restricted HTML into a Screen DSL document, serialize it using `writeCanonicalScreenDslJson`, and call `createScreenDslPreview` with `format: 'json'`. On parser errors return a non-applyable preview with structured diagnostics; do not construct a mutation.

- [ ] **Step 4: Run preview/apply regression tests**

Run: `npx vitest run tests/utils/screenHtmlPreview.test.ts tests/utils/screenDslUpdateAtomicity.test.ts --reporter=verbose`

Expected: PASS; an approved preview applies once through `applyScreenDslPreview`, increments revision exactly once and can be undone.

### Task 3: Publish the MCP read/write tools and 128×64 analyzer

**Files:**
- Modify: `src/shared/automation/registry.ts`
- Modify: `src/renderer/automation/automationDispatcher.ts`
- Modify: `tests/utils/automationRegistry.test.ts`
- Modify: `tests/utils/automationDispatcher.test.ts`

**Interfaces:**
- Consumes: HTML serializer, screen HTML preview facade, current `projectStore.session`, `renderProjectScreen`, and `analyzeScreenLayout`.
- Produces: `export_screen_html`, `preview_screen_html_import`, `apply_screen_html_import`, and `analyze_128x64_screens` MCP commands.

- [ ] **Step 1: Write failing registry and dispatcher contract tests**

```ts
const exported = await executeAutomationRequest(request('export_screen_html', { screenId }));
expect(exported.output).toEqual(expect.objectContaining({ html: expect.stringContaining('data-lcd-format'), width: 128, height: 64 }));

const audited = await executeAutomationRequest(request('analyze_128x64_screens'));
expect(audited.output).toEqual(expect.objectContaining({ target: { width: 128, height: 64 }, screens: expect.any(Array) }));
```

- [ ] **Step 2: Run the focused automation tests and confirm unknown-command failures**

Run: `npx vitest run tests/utils/automationRegistry.test.ts tests/utils/automationDispatcher.test.ts --reporter=verbose`

Expected: the four new command names are absent and dispatcher returns structured failures.

- [ ] **Step 3: Register strict schemas**

Add read tools `export_screen_html({ screenId })` and `analyze_128x64_screens({ screenId? })`. Add write tools `preview_screen_html_import({ html, importMode, targetScreenId?, expectedRevision })` and `apply_screen_html_import({ html, importMode, targetScreenId?, expectedRevision, confirmDestructive? })`. Use `project:read` for read tools and `project:write` for import tools.

- [ ] **Step 4: Implement dispatcher handlers**

Export only through Screen Interchange and attach layout diagnostics. The analyzer must return each screen’s id, actual dimensions, `dimensionsMatch`, object count, layout issues, and aggregate compliant/noncompliant counts. Preview must be non-mutating. Apply must reject a failed preview, require revision parity, run `applyScreenDslPreview`, then refresh the store session through `replaceProjectStoreSession`.

- [ ] **Step 5: Run focused automation tests**

Run: `npx vitest run tests/utils/automationRegistry.test.ts tests/utils/automationDispatcher.test.ts --reporter=verbose`

Expected: PASS with MCP schemas derived from the shared registry and one undoable apply revision.

### Task 4: Verify real ECROS integration and package the renderer

**Files:**
- Test: `tests/utils/ecrosSeptemberKeyboard.test.ts`
- Test: `tests/utils/runtimeTimer.test.ts`
- Verify: `ECROS-5400UV/ECROS-5400UV_FSM_11-09-2026.lcdproj`

- [ ] **Step 1: Add an ECROS HTML-export smoke test**

```ts
it('exports an existing September ECROS screen to a 128×64 HTML interchange document', () => {
  const outcome = await executeAutomationRequest(request('export_screen_html', { screenId: 'MAINMNU_SEL_PHOT' }));
  expect(outcome.status).toBe('success');
  expect(outcome.output).toEqual(expect.objectContaining({ width: 128, height: 64 }));
});
```

- [ ] **Step 2: Run targeted functional tests**

Run: `npx vitest run tests/utils/screenHtmlInterchange.test.ts tests/utils/screenHtmlPreview.test.ts tests/utils/automationRegistry.test.ts tests/utils/automationDispatcher.test.ts tests/utils/ecrosSeptemberKeyboard.test.ts tests/utils/phoneKeypadInput.test.ts tests/utils/runtimeTimer.test.ts --reporter=verbose`

Expected: all selected tests PASS.

- [ ] **Step 3: Run static and production build checks**

Run: `npm run typecheck && npm run build:renderer && npm run electron:build`

Expected: typecheck and renderer build PASS; record Electron packaging outcome separately if host signing/toolchain is unavailable.

- [ ] **Step 4: Reload the running IDE and verify MCP capability discovery**

Open/reload the local application, query `get_capabilities`, and confirm all four HTML/MCP tools appear. Export a real ECROS screen, preview its unchanged HTML, apply only if preview reports zero errors, then verify the 128×64 analyzer report.

## Plan self-review

- Spec coverage: Tasks 1–2 implement deterministic bidirectional conversion and transaction safety; Task 3 exposes all MCP tools and analyzer; Task 4 covers real ECROS and packaging verification.
- No placeholders: every task names files, interfaces, test command and expected result.
- Type consistency: Task 1 produces Screen DSL text consumed by Task 2; Task 2’s `ScreenDslPreviewResult` is consumed by Task 3 apply handling.
