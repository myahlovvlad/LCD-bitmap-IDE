import { beforeEach, describe, expect, it } from 'vitest';
import type { AutomationRequest } from '../../src/shared/automation';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import { rebuildProjectBindings } from '../../src/domain/project';
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
    correlationId: `ux-test-${sequence}`,
    source: 'test',
    permissions,
    ...options
  };
}

describe('UX automation tools', () => {
  beforeEach(() => {
    sequence = 0;
    resetAutomationDispatcherForTests();
    useProjectStore.getState().loadProjectSnapshot(migrateLegacySnapshot(createDemoProject()));
  });

  it('exposes read tools with no expectedRevision requirement', async () => {
    for (const command of ['get_project_ux_contract', 'list_project_ux_scenarios', 'analyze_project_ux', 'export_project_ux_review_packet']) {
      const outcome = await executeAutomationRequest(request(command));
      expect(outcome.status, `${command} should succeed without a revision`).toBe('success');
    }
  });

  it('requires expectedRevision for apply_project_ux_contract_update', async () => {
    const outcome = await executeAutomationRequest(request('apply_project_ux_contract_update', { uxContract: { projectPurpose: 'x' } }));
    expect(outcome.status).toBe('conflict');
    expect(outcome.diagnostics[0].code).toBe('automation.expected-revision-required');
  });

  it('previews a contract update without mutating the project', async () => {
    const before = useProjectStore.getState().project!.uxContract?.projectPurpose;
    const outcome = await executeAutomationRequest(request('preview_project_ux_contract_update', {
      uxContract: { projectPurpose: 'Laboratory photometer operator workflow.' }
    }, { expectedRevision: 0 }));
    expect(outcome.status).toBe('success');
    expect(useProjectStore.getState().revision).toBe(0);
    expect(useProjectStore.getState().project!.uxContract?.projectPurpose).toBe(before);
  });

  it('applies a contract update exactly once and makes it undoable', async () => {
    const purposeBefore = useProjectStore.getState().project!.uxContract?.projectPurpose;
    const applied = await executeAutomationRequest(request('apply_project_ux_contract_update', {
      uxContract: { projectPurpose: 'Laboratory photometer operator workflow.' }
    }, { expectedRevision: 0 }));
    expect(applied.status).toBe('success');
    expect(applied.revisionAfter).toBe(1);
    expect(useProjectStore.getState().project!.uxContract?.projectPurpose).toBe('Laboratory photometer operator workflow.');

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project!.uxContract?.projectPurpose).toBe(purposeBefore);
  });

  it('returns a structured failure for an unknown scenario id instead of throwing', async () => {
    const outcome = await executeAutomationRequest(request('run_project_ux_scenario', { scenarioId: 'does-not-exist' }));
    expect(outcome.status).toBe('failure');
    expect(outcome.diagnostics[0].code).toBe('automation.ux-scenario-not-found');
  });

  it('runs a scenario declared through a contract update and reports its trace', async () => {
    const applied = await executeAutomationRequest(request('apply_project_ux_contract_update', {
      uxContract: {
        scenarios: [{ id: 'sc-1', title: 'Start measurement', initialStateId: 'main-menu', steps: [{ type: 'event', eventId: 'START' }], expectedFinalStateId: 'measure' }]
      }
    }, { expectedRevision: 0 }));
    expect(applied.status).toBe('success');

    const ran = await executeAutomationRequest(request('run_project_ux_scenario', { scenarioId: 'sc-1' }));
    expect(ran.status).toBe('success');
    expect((ran.output as { passed: boolean }).passed).toBe(true);
  });

  it('produces a deterministic analysis across repeated calls', async () => {
    const first = await executeAutomationRequest(request('analyze_project_ux'));
    const second = await executeAutomationRequest(request('analyze_project_ux'));
    const firstIds = (first.output as { findings: { id: string }[] }).findings.map((f) => f.id);
    const secondIds = (second.output as { findings: { id: string }[] }).findings.map((f) => f.id);
    expect(firstIds).toEqual(secondIds);
  });

  it('rejects a malformed LLM review response structurally', async () => {
    const outcome = await executeAutomationRequest(request('import_project_ux_review', { response: { findings: 'not-an-array' } }));
    expect(outcome.status).toBe('failure');
  });

  it('imports a valid LLM review as non-blocking heuristic findings that never fail the verdict', async () => {
    // glyph-test is intentionally orphaned in the demo project and is its only source of
    // deterministic 'error' findings; remove it so this test isolates the heuristic-only path.
    const project = useProjectStore.getState().project!;
    delete project.fsm.states['glyph-test'];
    project.fsm.stateOrder = project.fsm.stateOrder.filter((id) => id !== 'glyph-test');
    project.bindings = rebuildProjectBindings(project);

    const imported = await executeAutomationRequest(request('import_project_ux_review', {
      response: {
        findings: [{
          category: 'semantics',
          severity: 'needs_human_review',
          message: 'The "Save" action might be confused with "Export" on this screen.',
          affected: { screenIds: [useProjectStore.getState().project!.screenOrder[0]] }
        }]
      }
    }));
    expect(imported.status).toBe('success');

    const analyzed = await executeAutomationRequest(request('analyze_project_ux', { includeHeuristicImportedFindings: true }));
    const output = analyzed.output as { verdict: string; findings: { source?: string }[] };
    expect(output.findings.some((f) => f.source === 'heuristic_llm')).toBe(true);
    expect(output.verdict).not.toBe('fail');
  });
});
