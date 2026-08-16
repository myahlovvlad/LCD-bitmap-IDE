import { beforeEach, describe, expect, it } from 'vitest';
import type { AutomationRequest } from '../../src/shared/automation';
import { createBlankProject } from '../../src/entities/project/factory';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import {
  executeAutomationRequest,
  resetAutomationDispatcherForTests
} from '../../src/renderer/automation/automationDispatcher';
import { useProjectStore } from '../../src/renderer/store/projectStore';

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
