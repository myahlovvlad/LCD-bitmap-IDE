import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import { createRuntimeEngine } from '../../src/services/runtimeEngine';
import { OrchestratedRuntimeEngine } from '../../src/services/runtime/orchestratedRuntimeEngine';
import { SimulationTransport } from '../../src/services/runtime/SimulationTransport';

function createInputProject(mode: 'numeric' | 'text') {
  const project = migrateLegacySnapshot(createDemoProject()).project;
  const template = Object.values(project.controlPanel.elements)
    .find((element) => element.type === 'button' && element.fsmEventId === 'START');
  if (!template || template.type !== 'button') throw new Error('Demo keypad template button is missing.');

  const addButton = (id: string, eventId: string, label: string) => {
    project.controlPanel.elements[id] = {
      ...template,
      id,
      label,
      fsmEventId: eventId,
      allowedStates: [],
      disabledStates: []
    };
    project.controlPanel.elementOrder.push(id);
    project.fsm.events[eventId] = { id: eventId, name: label };
    project.fsm.eventOrder.push(eventId);
    return id;
  };

  const keys = {
    two: addButton('key-2', 'UI.K2', '2 ABC'),
    three: addButton('key-3', 'UI.K3', '3 DEF'),
    five: addButton('key-5', 'UI.K5', '5 JKL'),
    eight: addButton('key-8', 'UI.K8', '8 TUV'),
    dot: addButton('key-dot', 'UI.DOT', '.'),
    clear: addButton('key-clear', 'UI.CLR', 'CLEAR'),
    ok: addButton('key-ok', 'UI.OK', 'OK')
  };

  project.fsm.states.measure.input = {
    mode,
    maxLength: 8,
    allowDecimal: true,
    allowNegative: true
  };
  project.fsm.transitions['tr-measure-save'].trigger.eventId = 'UI.OK';

  return { project, keys };
}

describe('phone-style virtual keypad', () => {
  it('edits a decimal value in an input state and commits it only on OK', () => {
    const { project, keys } = createInputProject('numeric');
    const runtime = createRuntimeEngine(project);
    runtime.start('measure');

    expect(runtime.isButtonAllowed(project.controlPanel.elements[keys.two] as never)).toBe(true);
    runtime.pressButton(keys.two);
    runtime.pressButton(keys.dot);
    runtime.pressButton(keys.five);
    expect(runtime.inputSession?.value).toBe('2.5');

    runtime.pressButton(keys.ok);

    expect(runtime.currentStateId).toBe('save-result');
    expect(runtime.lastInputCommit).toMatchObject({ stateId: 'measure', mode: 'numeric', value: '2.5' });
  });

  it('cycles letters on repeated phone-key presses and clears the last character', () => {
    const { project, keys } = createInputProject('text');
    const runtime = createRuntimeEngine(project);
    runtime.start('measure');

    runtime.pressButton(keys.two);
    runtime.pressButton(keys.two);
    runtime.pressButton(keys.two);
    runtime.pressButton(keys.three);
    runtime.pressButton(keys.eight);
    expect(runtime.inputSession?.value).toBe('CDT');

    runtime.pressButton(keys.clear);
    expect(runtime.inputSession?.value).toBe('CD');
  });

  it('keeps phone-key input local when the runtime is wrapped with procedure orchestration', () => {
    const { project, keys } = createInputProject('numeric');
    const runtime = new OrchestratedRuntimeEngine(project, {
      transport: new SimulationTransport(project.cliCatalog ?? {}),
      bypassProcedures: false
    });
    runtime.start('measure');

    runtime.pressButton(keys.two);
    runtime.pressButton(keys.five);

    expect(runtime.inputSession?.value).toBe('25');
    expect(runtime.currentStateId).toBe('measure');
  });

  it('executes a normal physical-button transition through procedure orchestration', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const runtime = new OrchestratedRuntimeEngine(project, {
      transport: new SimulationTransport(project.cliCatalog ?? {}),
      bypassProcedures: false
    });
    const start = Object.values(project.controlPanel.elements)
      .find((element) => element.type === 'button' && element.fsmEventId === 'START');
    if (!start || start.type !== 'button') throw new Error('Demo START button is missing.');

    runtime.start('main-menu');
    runtime.pressButton(start.id);

    expect(runtime.currentStateId).toBe('measure');
  });
});
