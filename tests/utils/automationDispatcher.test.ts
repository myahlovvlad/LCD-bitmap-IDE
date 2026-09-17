import { beforeEach, describe, expect, it } from 'vitest';
import type { AutomationRequest } from '../../src/shared/automation';
import { createBlankProject } from '../../src/entities/project/factory';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import {
  executeAutomationRequest,
  resetAutomationDispatcherForTests
} from '../../src/renderer/automation/automationDispatcher';
import { useProjectStore } from '../../src/renderer/store/projectStore';
import { createDisplayProfile } from '../../src/domain';

const permissions = ['project:read', 'project:write', 'project:destructive', 'runtime:write'];
let sequence = 0;

function request(command: string, input: unknown = {}, options: Partial<AutomationRequest> = {}): AutomationRequest {
  sequence += 1;
  return {
    command,
    input,
    correlationId: `test-${sequence}`,
    source: 'test',
    permissions,
    ...options
  };
}

describe('renderer automation dispatcher', () => {
  beforeEach(() => {
    sequence = 0;
    resetAutomationDispatcherForTests();
    useProjectStore.getState().loadProjectSnapshot(
      migrateLegacySnapshot(createBlankProject({ name: 'Automation Test' }))
    );
  });

  it('requires explicit revision for writes and reports conflicts structurally', async () => {
    const missing = await executeAutomationRequest(request('set_authoring_language', { language: 'ru' }));
    expect(missing.status).toBe('conflict');
    expect(missing.diagnostics[0].code).toBe('automation.expected-revision-required');

    const stale = await executeAutomationRequest(request('set_authoring_language', { language: 'ru' }, { expectedRevision: 99 }));
    expect(stale.status).toBe('conflict');
    expect(useProjectStore.getState().revision).toBe(0);
  });

  it('dry-runs through the command bus without mutating, then applies one undoable revision', async () => {
    const preview = await executeAutomationRequest(request('set_authoring_language', { language: 'ru' }, {
      expectedRevision: 0,
      dryRun: true
    }));
    expect(preview.status).toBe('success');
    expect(preview.changes).toEqual([expect.objectContaining({ path: '/authoringLanguage', after: 'ru' })]);
    expect(useProjectStore.getState().revision).toBe(0);
    expect(useProjectStore.getState().project?.authoringLanguage).toBe('en');

    const applied = await executeAutomationRequest(request('set_authoring_language', { language: 'ru' }, {
      expectedRevision: 0,
      idempotencyKey: 'language-ru'
    }));
    expect(applied.status).toBe('success');
    expect(applied.revisionAfter).toBe(1);
    expect(useProjectStore.getState().project?.authoringLanguage).toBe('ru');
    expect(useProjectStore.getState().undoStack).toHaveLength(1);
  });

  it('deduplicates idempotency keys without incrementing revision twice', async () => {
    const firstRequest = request('create_screen', { name: 'Diagnostics' }, {
      expectedRevision: 0,
      idempotencyKey: 'create-diagnostics'
    });
    const first = await executeAutomationRequest(firstRequest);
    const second = await executeAutomationRequest({ ...firstRequest, correlationId: 'retry-correlation' });
    expect(first.status).toBe('success');
    expect(second.status).toBe('noop');
    expect(second.correlationId).toBe('retry-correlation');
    expect(second.diagnostics[0].code).toBe('automation.idempotent-replay');
    expect(second.output).toEqual(expect.objectContaining({ originalCorrelationId: first.correlationId }));
    expect(useProjectStore.getState().revision).toBe(1);
    expect(useProjectStore.getState().project?.screenOrder.filter((id) => id === 'diagnostics')).toHaveLength(1);
  });

  it('routes tags through revision, semantic diff and undo instead of direct Zustand mutation', async () => {
    const outcome = await executeAutomationRequest(request('upsert_tag', {
      tag: { id: 'sample.abs', name: { en: 'Absorbance', ru: 'Оптическая плотность' }, dataType: 'float' }
    }, { expectedRevision: 0 }));
    expect(outcome.status).toBe('success');
    expect(outcome.changes).toEqual([expect.objectContaining({ entityType: 'tag', path: '/tags/sample.abs' })]);
    expect(useProjectStore.getState().revision).toBe(1);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project?.tags?.['sample.abs']).toBeUndefined();
  });

  it('exposes DisplayProfile update and zero-diff evidence through the shared registry', async () => {
    const current = useProjectStore.getState().project!.display;
    const profile = createDisplayProfile({ ...current, mirrorX: true });
    const updated = await executeAutomationRequest(request('update_display_profile', { profile }, { expectedRevision: 0 }));
    expect(updated.status).toBe('success');
    expect(useProjectStore.getState().project?.display.fingerprint).toBe(profile.fingerprint);

    const preview = await executeAutomationRequest(request('preview_export'));
    expect(preview.status).toBe('success');
    expect(preview.output).toEqual(expect.objectContaining({
      profileFingerprint: profile.fingerprint,
      comparison: expect.objectContaining({ differentPixels: 0, result: 'passed' })
    }));
  });

  it('renders a screen with deterministic PNG previews and layout diagnostics', async () => {
    const rendered = await executeAutomationRequest(request('render_screen'));
    expect(rendered.status).toBe('success');
    expect(rendered.output).toEqual(expect.objectContaining({
      width: 128,
      height: 64,
      previewPngBase64: expect.stringMatching(/^iVBOR/),
      overlayPngBase64: expect.stringMatching(/^iVBOR/),
      canonicalRaster: expect.objectContaining({ pixelFormat: 'argb8888', byteLength: 128 * 64 * 4 }),
      boundingBoxes: expect.any(Array),
      issues: expect.any(Array)
    }));
  });

  it('exports a screen as HTML and audits 128×64 layout compliance without mutation', async () => {
    const screenId = useProjectStore.getState().project!.screenOrder[0];
    const exported = await executeAutomationRequest(request('export_screen_html', { screenId }));
    const audited = await executeAutomationRequest(request('analyze_128x64_screens'));

    expect(exported.status).toBe('success');
    expect(exported.output).toEqual(expect.objectContaining({
      screenId,
      width: 128,
      height: 64,
      html: expect.stringContaining('data-lcd-format="lcd-bitmap-ide/html"')
    }));
    expect(audited.status).toBe('success');
    expect(audited.output).toEqual(expect.objectContaining({
      target: { width: 128, height: 64 },
      screenCount: 1,
      compliantScreenCount: 1,
      nonCompliantScreenCount: 0
    }));
    expect(useProjectStore.getState().revision).toBe(0);
  });

  it('previews and applies a validated HTML screen import through one revision', async () => {
    const screenId = useProjectStore.getState().project!.screenOrder[0];
    const exported = await executeAutomationRequest(request('export_screen_html', { screenId }));
    const html = (exported.output as { html: string }).html;
    const editedHtml = html.replace('</section>', '<lcd-rect data-lcd-id="html-import-rect" data-lcd-order="0" data-lcd-z-index="0" data-lcd-visible="true" data-lcd-locked="false" data-lcd-source="generated" data-lcd-resource-refs="[]" data-lcd-x="1" data-lcd-y="1" data-lcd-width="4" data-lcd-height="4" data-lcd-filled="true"></lcd-rect>\n</section>');
    const preview = await executeAutomationRequest(request('preview_screen_html_import', {
      html: editedHtml, importMode: 'update', targetScreenId: screenId
    }, { expectedRevision: 0 }));
    const applied = await executeAutomationRequest(request('apply_screen_html_import', {
      html: editedHtml, importMode: 'update', targetScreenId: screenId
    }, { expectedRevision: 0 }));

    expect(preview.status).toBe('success');
    expect(preview.output).toEqual(expect.objectContaining({ canonicalHtml: expect.stringContaining('data-lcd-screen-id') }));
    expect(applied.status).toBe('success');
    expect(useProjectStore.getState().revision).toBe(1);
  });

  it('previews and applies an atomic multi-operation ChangeSet', async () => {
    const operations = [
      { command: 'create_screen', input: { name: 'Diagnostics' } },
      { command: 'set_authoring_language', input: { language: 'ru' } }
    ];
    const preview = await executeAutomationRequest(request('preview_changes', { operations }, { expectedRevision: 0 }));
    expect(preview.status).toBe('success');
    expect(preview.changes.length).toBeGreaterThan(1);
    expect(useProjectStore.getState().revision).toBe(0);

    const applied = await executeAutomationRequest(request('apply_changes', { operations }, { expectedRevision: 0 }));
    expect(applied.status).toBe('success');
    expect(useProjectStore.getState().revision).toBe(1);
    expect(useProjectStore.getState().project?.screens.diagnostics).toBeDefined();
    expect(useProjectStore.getState().project?.authoringLanguage).toBe('ru');
    expect(useProjectStore.getState().undoStack).toHaveLength(1);
  });

  it('enforces nested destructive permissions in ChangeSets', async () => {
    const screenId = useProjectStore.getState().project!.screenOrder[0];
    const outcome = await executeAutomationRequest(request('apply_changes', {
      operations: [{ command: 'delete_screen', input: { screenId } }]
    }, { expectedRevision: 0, permissions: ['project:write'] }));
    expect(outcome.status).toBe('blocked');
    expect(useProjectStore.getState().revision).toBe(0);
  });

  it('exports the FSM graph as Mermaid and round-trips an unmodified re-import as a noop', async () => {
    const exported = await executeAutomationRequest(request('export_fsm_script', { format: 'mermaid' }));
    expect(exported.status).toBe('success');
    const source = (exported.output as { source: string }).source;
    expect(source.length).toBeGreaterThan(0);

    const preview = await executeAutomationRequest(request('preview_fsm_script_import', { source, format: 'mermaid' }, { expectedRevision: 0 }));
    expect(preview.status).toBe('success');
    expect(preview.output).toEqual(expect.objectContaining({ ok: true, format: 'mermaid' }));

    const applied = await executeAutomationRequest(request('apply_fsm_script_import', { source, format: 'mermaid' }, { expectedRevision: 0 }));
    expect(applied.status).toBe('noop');
    expect(useProjectStore.getState().revision).toBe(0);
  });

  it('rejects a malformed FSM script import without mutating the project', async () => {
    const preview = await executeAutomationRequest(request('preview_fsm_script_import', {
      source: 'this is not a valid mermaid or python fsm script @@@ ///',
      format: 'mermaid'
    }, { expectedRevision: 0 }));
    expect((preview.output as { ok: boolean } | undefined)?.ok ?? false).toBe(false);

    const applied = await executeAutomationRequest(request('apply_fsm_script_import', {
      source: 'this is not a valid mermaid or python fsm script @@@ ///',
      format: 'mermaid'
    }, { expectedRevision: 0 }));
    expect(applied.status).toBe('failure');
    expect(useProjectStore.getState().revision).toBe(0);
  });

  it('builds a two-state FSM via automation commands and verifies it deterministically with run_fsm_scenario', async () => {
    const stateBefore = useProjectStore.getState().project!.fsm.stateOrder[0];

    const created = await executeAutomationRequest(request('create_fsm_state', { title: 'Second State' }, { expectedRevision: 0 }));
    expect(created.status).toBe('success');
    const stateAfter = useProjectStore.getState().project!.fsm.stateOrder.find((id) => id !== stateBefore)!;
    expect(stateAfter).toBeDefined();

    const linked = await executeAutomationRequest(request('create_fsm_transition', {
      from: stateBefore, to: stateAfter
    }, { expectedRevision: 1 }));
    expect(linked.status).toBe('success');
    // create_fsm_transition auto-creates a fresh FSM event when none is given —
    // read back its real id rather than assuming one, the same way an agent
    // would discover it via list_fsm_transitions before scripting a scenario.
    const transitionId = useProjectStore.getState().project!.fsm.transitionOrder.at(-1)!;
    const eventId = useProjectStore.getState().project!.fsm.transitions[transitionId].trigger.eventId;

    const scenario = await executeAutomationRequest(request('run_fsm_scenario', {
      steps: [{ type: 'event', eventId }],
      initialStateId: stateBefore
    }));
    expect(scenario.status).toBe('success');
    expect(scenario.output).toEqual(expect.objectContaining({
      initialStateId: stateBefore,
      finalStateId: stateAfter
    }));
    expect((scenario.output as { steps: Array<{ blocked: boolean }> }).steps[0].blocked).toBe(false);
    // A pure read/simulation tool must not touch the live project revision.
    expect(useProjectStore.getState().revision).toBe(2);
  });

  it('reports a blocked step from run_fsm_scenario when no transition matches the event', async () => {
    const stateId = useProjectStore.getState().project!.fsm.stateOrder[0];
    const scenario = await executeAutomationRequest(request('run_fsm_scenario', {
      steps: [{ type: 'event', eventId: 'NO_SUCH_EVENT' }],
      initialStateId: stateId
    }));
    expect(scenario.status).toBe('success');
    const output = scenario.output as { finalStateId: string; steps: Array<{ blocked: boolean; blockReason?: string }> };
    expect(output.finalStateId).toBe(stateId);
    expect(output.steps[0].blocked).toBe(true);
    expect(output.steps[0].blockReason).toContain('NO_SUCH_EVENT');
  });

  it('returns a structured failure for a malformed transport envelope', async () => {
    const outcome = await executeAutomationRequest({
      command: 'get_project_revision',
      correlationId: 'malformed',
      source: 'electron-rest',
      permissions: 'project:read',
      unexpected: true
    });
    expect(outcome.status).toBe('failure');
    expect(outcome.command).toBe('get_project_revision');
    expect(outcome.correlationId).toBe('malformed');
    expect(outcome.diagnostics.every((item) => item.code === 'automation.invalid-request')).toBe(true);
    expect(outcome.audit.status).toBe('failure');
  });
});
