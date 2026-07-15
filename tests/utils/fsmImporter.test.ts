import { describe, expect, it } from 'vitest';
import { importFsmModel, slugify } from '../../src/renderer/core/fsmImporter';
import { loadBundledFsmModel } from '../../src/renderer/core/loadBundledFsm';

describe('FSM importer', () => {
  it('maps defaults, layouts, LCD lines and CLI command variants', () => {
    const imported = importFsmModel({
      project: ' Test Project ',
      states: [
        { id: 'A', lcd: ['Title', '', 'Line 3'], runtime_id: 'run-a' },
        { id: 'B', subsystem: 'files', type: 'final', origin: 'test', legacy: ['old-b'] }
      ],
      transitions: [
        { frm: 'A', to: 'B', trigger: 'ENTER', cli_command: 'CMD:A' },
        { from: 'B', to: 'A', cliCommands: ['CMD:B', ''], condition: 'ok', source: 'test' }
      ],
      layouts: {
        A: { x: 12, y: 34 },
        B: { x: Number.NaN, y: 1 }
      }
    });

    expect(imported.project.id).toBe('test-project');
    expect(imported.project.states.A.runtimeId).toBe('run-a');
    expect(imported.project.states.B.legacyIds).toEqual(['old-b']);
    expect(imported.project.canvasByStateId.A.objects).toHaveLength(2);
    expect(imported.project.graphLayout).toEqual({ A: { x: 12, y: 34 } });
    expect(imported.project.transitions[imported.transitionOrder[0]].cliCommands).toEqual(['CMD:A']);
    expect(imported.project.transitions[imported.transitionOrder[1]].cliCommands).toEqual(['CMD:B']);
  });

  it('imports an empty model with safe defaults', () => {
    const imported = importFsmModel({});
    expect(imported.project.name).toBe('SpectroDesigner Project');
    expect(imported.stateOrder).toEqual([]);
    expect(imported.project.graphLayout).toEqual({});
  });

  it('loads the complete bundled model', () => {
    const imported = loadBundledFsmModel();
    expect(imported.stateOrder.length).toBe(5);
    expect(imported.transitionOrder.length).toBe(4);
    expect(imported.project.modelId).toBe('Universal-LCD-128x64');
  });

  it('creates stable safe slugs', () => {
    expect(slugify('  Main Menu / 1 ')).toBe('main-menu-1');
    expect(slugify('***')).toBe('item');
  });
});
