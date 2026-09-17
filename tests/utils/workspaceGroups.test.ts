import { describe, expect, it } from 'vitest';
import type { WorkspaceMode } from '../../src/domain/project';
import { groupForWorkspace, WORKSPACE_GROUPS } from '../../src/renderer/navigation/workspaceGroups';

const EXPECTED_GROUPED_MODES: WorkspaceMode[] = [
  'fsm',
  'lcd',
  'control-panel',
  'hmi',
  'preview',
  'tags',
  'procedures',
  'alarms',
  'runtime',
  'screen-dsl',
  'text-registry',
  'handoff',
  'ux-validation'
];

describe('workspace navigation groups', () => {
  it('assigns every editor workspace to exactly one group while keeping Settings global', () => {
    const groupedModes = WORKSPACE_GROUPS.flatMap((group) => [...group.modes]);

    expect(groupedModes).toHaveLength(new Set(groupedModes).size);
    expect([...groupedModes].sort()).toEqual([...EXPECTED_GROUPED_MODES].sort());
    expect(groupedModes).not.toContain('settings');
  });

  it('resolves deep-linked workspaces to their containing group', () => {
    expect(groupForWorkspace('lcd')).toBe('interface');
    expect(groupForWorkspace('fsm')).toBe('logic');
    expect(groupForWorkspace('tags')).toBe('hardware');
    expect(groupForWorkspace('runtime')).toBe('delivery');
    expect(groupForWorkspace('settings')).toBe('logic');
  });
});
