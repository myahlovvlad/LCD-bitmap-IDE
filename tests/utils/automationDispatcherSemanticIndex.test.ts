import { beforeEach, describe, expect, it } from 'vitest';
import type { AutomationRequest } from '../../src/shared/automation';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import { executeAutomationRequest, resetAutomationDispatcherForTests } from '../../src/renderer/automation/automationDispatcher';
import { useProjectStore } from '../../src/renderer/store/projectStore';

const permissions = ['project:read', 'project:write', 'project:destructive', 'runtime:write'];
let sequence = 0;
function request(command: string, input: unknown = {}): AutomationRequest {
  sequence += 1;
  return { command, input, correlationId: `semantic-${sequence}`, source: 'test', permissions };
}

describe('semantic index automation tools', () => {
  beforeEach(() => {
    sequence = 0;
    resetAutomationDispatcherForTests();
    useProjectStore.getState().loadProjectSnapshot(migrateLegacySnapshot(createDemoProject()));
  });

  it('exposes the derived index without requiring expectedRevision or mutating revision', async () => {
    const before = useProjectStore.getState().revision;
    const outcome = await executeAutomationRequest(request('get_project_semantic_index'));
    expect(outcome.status).toBe('success');
    expect((outcome.output as { semanticIndex: { states: unknown[] } }).semanticIndex.states.length).toBeGreaterThan(0);
    expect(useProjectStore.getState().revision).toBe(before);
  });

  it('lists semantic workflows deterministically', async () => {
    const first = await executeAutomationRequest(request('list_project_semantic_workflows'));
    const second = await executeAutomationRequest(request('list_project_semantic_workflows'));
    expect(first.status).toBe('success');
    expect(first.output).toEqual(second.output);
  });

  it('returns a structured failure for an unknown semantic workflow', async () => {
    const outcome = await executeAutomationRequest(request('get_project_semantic_workflow', { workflowId: 'does-not-exist' }));
    expect(outcome.status).toBe('failure');
    expect(outcome.diagnostics[0].code).toBe('automation.semantic-workflow-not-found');
  });
});
