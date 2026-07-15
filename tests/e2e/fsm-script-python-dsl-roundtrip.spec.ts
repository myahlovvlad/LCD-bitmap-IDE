import { expect, test } from '@playwright/test';
import { AppShellPage } from './pages/AppShellPage';
import { FsmScriptStudioPage } from './pages/FsmScriptStudioPage';
import { FsmWorkspacePage } from './pages/FsmWorkspacePage';

test('Python-like DSL stays declarative and round-trips transition handles', async ({ page }) => {
  const app = new AppShellPage(page);
  const fsm = new FsmWorkspacePage(page);
  const scripts = new FsmScriptStudioPage(page);

  await app.openDemo();
  await app.openFsmWorkspace();
  await fsm.openScriptStudio();

  const original = await scripts.sourceText('python');
  expect(original).not.toContain('import ');
  expect(original).not.toContain('def ');
  expect(original).not.toContain('eval(');
  expect(original).not.toContain('exec(');
  await scripts.expectApplyDisabled('python');

  const updated = original
    .replace('title="Measurement"', 'title="Measurement DSL"')
    .replace('source_handle="s-right", target_handle="t-left"', 'source_handle="s-bottom", target_handle="t-top"')
    .concat('\nfsm.event(id="RESET", name="RESET", order=4)\nfsm.transition(id="tr-error-glyph-test", from="error", to="glyph-test", event="RESET", mechanism="event", source_handle="s-right", target_handle="t-left", kind="navigation", source="e2e", order=4)');

  await scripts.setScriptText('python', updated);
  await scripts.requestPreview('python');
  await scripts.expectPreviewReady();
  await scripts.expectSemanticChange('state.update', 'measure');
  await scripts.expectSemanticChange('transition.update', 'tr-main-measure');
  await scripts.expectSemanticChange('transition.create', 'tr-error-glyph-test');

  await scripts.applyPreview('python');
  await fsm.expectStateTitle('measure', 'Measurement DSL');
  await app.undo();
  await fsm.expectStateTitle('measure', 'Measurement');
  await app.redo();
  await fsm.expectStateTitle('measure', 'Measurement DSL');

  await app.waitForAutosaveText('Measurement DSL');
  await app.reloadAutosave();
  await fsm.openScriptStudio();
  const regenerated = await scripts.sourceText('python');
  expect(regenerated).toContain('title="Measurement DSL"');
  expect(regenerated).toContain('source_handle="s-bottom", target_handle="t-top"');
  expect(regenerated).toContain('id="tr-error-glyph-test"');
  expect(regenerated).not.toContain('import ');
});
