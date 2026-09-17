import { describe, expect, it } from 'vitest';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import { createDemoProject } from '../../src/entities/project/demo';
import { buildUxContractIdRefs, normalizeUxContract, DEFAULT_UX_POLICIES } from '../../src/domain/uxContract';

function loadDemoProject() {
  return migrateLegacySnapshot(createDemoProject()).project;
}

describe('normalizeUxContract', () => {
  it('gives a legacy project with no uxContract a fully-populated, default contract', () => {
    const project = loadDemoProject();
    expect(project.uxContract).toBeDefined();
    expect(project.uxContract!.version).toBe(1);
    expect(project.uxContract!.screens).toEqual({});
    expect(project.uxContract!.policies).toEqual(DEFAULT_UX_POLICIES);
  });

  it('does not throw and returns a default contract for garbage input', () => {
    const project = loadDemoProject();
    const refs = buildUxContractIdRefs(project);
    const contract = normalizeUxContract('not-an-object', refs);
    expect(contract.screens).toEqual({});
    expect(contract.scenarios).toEqual([]);
  });

  it('drops references to states/screens/transitions/controls that no longer exist', () => {
    const project = loadDemoProject();
    const refs = buildUxContractIdRefs(project);
    const contract = normalizeUxContract({
      states: { 'does-not-exist': { role: 'error' }, 'main-menu': { role: 'navigation' } },
      transitions: { 'tr-ghost': { intent: 'ghost' }, 'tr-main-measure': { intent: 'start' } },
      screens: { 'ghost-screen': { role: 'error' } },
      controls: { 'ghost-control': { intent: 'ghost' } }
    }, refs);

    expect(contract.states['does-not-exist']).toBeUndefined();
    expect(contract.states['main-menu']).toEqual({ role: 'navigation' });
    expect(contract.transitions['tr-ghost']).toBeUndefined();
    expect(contract.transitions['tr-main-measure']).toEqual({ intent: 'start' });
    expect(contract.screens['ghost-screen']).toBeUndefined();
    expect(contract.controls['ghost-control']).toBeUndefined();
  });

  it('drops a user goal referencing a start/success state that no longer exists', () => {
    const project = loadDemoProject();
    const refs = buildUxContractIdRefs(project);
    const contract = normalizeUxContract({
      userGoals: [{
        id: 'goal-1', title: 'Goal',
        startStateIds: ['main-menu', 'ghost-state'],
        successStateIds: ['save-result']
      }]
    }, refs);
    expect(contract.userGoals[0].startStateIds).toEqual(['main-menu']);
    expect(contract.userGoals[0].successStateIds).toEqual(['save-result']);
  });

  it('merges partial policy overrides over the defaults', () => {
    const project = loadDemoProject();
    const refs = buildUxContractIdRefs(project);
    const contract = normalizeUxContract({ policies: { requireErrorRecoveryPath: false } }, refs);
    expect(contract.policies.requireErrorRecoveryPath).toBe(false);
    expect(contract.policies.requireConfirmationForDestructiveActions).toBe(true);
  });

  it('drops a scenario step referencing an unrecognized shape', () => {
    const project = loadDemoProject();
    const refs = buildUxContractIdRefs(project);
    const contract = normalizeUxContract({
      scenarios: [
        { id: 'sc-1', title: 'Valid', steps: [{ type: 'event', eventId: 'START' }] },
        { id: 'sc-2', title: 'No steps survive', steps: [{ type: 'bogus' }] }
      ]
    }, refs);
    expect(contract.scenarios).toHaveLength(1);
    expect(contract.scenarios[0].id).toBe('sc-1');
  });
});
