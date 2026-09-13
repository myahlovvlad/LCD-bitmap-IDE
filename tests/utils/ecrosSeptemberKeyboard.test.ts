import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ControlPanelButton } from '../../src/domain/project';
import { migrateProject } from '../../src/services/projectMigrationService';
import { createRuntimeEngine } from '../../src/services/runtimeEngine';
import { OrchestratedRuntimeEngine } from '../../src/services/runtime/orchestratedRuntimeEngine';
import { SimulationTransport } from '../../src/services/runtime/SimulationTransport';

const PROJECT_FILE = resolve(process.cwd(), 'ECROS-5400UV', 'ECROS-5400UV_FSM_11-09-2026.lcdproj');
const project = migrateProject(JSON.parse(readFileSync(PROJECT_FILE, 'utf8'))).project;

function physicalButton(eventId: string): ControlPanelButton {
  const button = project.controlPanel.elementOrder
    .map((id) => project.controlPanel.elements[id])
    .find((element): element is ControlPanelButton => element?.type === 'button' && element.fsmEventId === eventId);
  if (!button) throw new Error(`Physical button for ${eventId} is missing.`);
  return button;
}

describe('ECROS-5400UV September virtual keyboard', () => {
  it('traverses every main-menu option with the physical parameter and arrow keys', () => {
    const engine = createRuntimeEngine(project);
    const parameter = physicalButton('UI.PAR');
    const down = physicalButton('UI.DOWN');
    const up = physicalButton('UI.UP');

    engine.start('WAITING');
    engine.pressButton(parameter.id);
    expect(engine.currentStateId).toBe('MAINMNU_SEL_PHOT');

    engine.pressButton(down.id);
    expect(engine.currentStateId).toBe('MAINMNU_SEL_QUANT');
    engine.pressButton(down.id);
    expect(engine.currentStateId).toBe('MAINMNU_SEL_MW');
    engine.pressButton(down.id);
    expect(engine.currentStateId).toBe('MAINMNU_SEL_KIN');
    engine.pressButton(down.id);
    expect(engine.currentStateId).toBe('MAINMNU_SEL_SET');

    engine.pressButton(up.id);
    expect(engine.currentStateId).toBe('MAINMNU_SEL_KIN');
    engine.pressButton(up.id);
    expect(engine.currentStateId).toBe('MAINMNU_SEL_MW');
    engine.pressButton(up.id);
    expect(engine.currentStateId).toBe('MAINMNU_SEL_QUANT');
    engine.pressButton(up.id);
    expect(engine.currentStateId).toBe('MAINMNU_SEL_PHOT');
  });

  it('executes a main-menu arrow transition in the orchestrated runtime', () => {
    const engine = new OrchestratedRuntimeEngine(project, {
      transport: new SimulationTransport(project.cliCatalog ?? {}),
      bypassProcedures: false
    });
    engine.start('MAINMNU_SEL_PHOT');

    engine.pressButton(physicalButton('UI.DOWN').id);

    expect(engine.currentStateId).toBe('MAINMNU_SEL_QUANT');
  });

  it('uses FSM routes as the single source of truth for every physical-key guard', () => {
    const buttons = project.controlPanel.elementOrder
      .map((id) => project.controlPanel.elements[id])
      .filter((element): element is ControlPanelButton => element?.type === 'button');

    for (const button of buttons) {
      const expectedStates = project.fsm.transitionOrder
        .map((id) => project.fsm.transitions[id])
        .filter((transition) => transition?.trigger.eventId === button.fsmEventId)
        .map((transition) => transition!.from)
        .filter((stateId, index, stateIds) => stateIds.indexOf(stateId) === index)
        .sort();
      const actualStates = [...(button.allowedStates ?? [])].sort();

      expect(actualStates, `${button.label} (${button.fsmEventId})`).toEqual(expectedStates);
    }
  });

  it('declares phone-key input only on parameter and file-name entry states', () => {
    const expectedPhoneKeys = [
      ['button-3', '1', 'UI.K1'],
      ['button-5', '2 ABC', 'UI.K2'],
      ['button-6', '3 DEF', 'UI.K3'],
      ['button-7', '4 GHI', 'UI.K4'],
      ['button-8', '5 JKL', 'UI.K5'],
      ['button-9', '6 MNO', 'UI.K6'],
      ['button-10', '7 PQRS', 'UI.K7'],
      ['button-11', '8 TUV', 'UI.K8'],
      ['button-12', '9 WXYZ', 'UI.K9A'],
      ['button-18', '0', 'UI.K0']
    ];
    for (const [id, label, eventId] of expectedPhoneKeys) {
      const button = project.controlPanel.elements[id];
      expect(button).toMatchObject({ type: 'button', label, fsmEventId: eventId });
    }

    expect(project.fsm.states.PHOT_IN_WL_IN.input).toMatchObject({ mode: 'numeric', allowDecimal: true });
    expect(project.fsm.states.PHOT_NAME_FILE.input).toMatchObject({ mode: 'text' });
    expect(project.fsm.states.PHOT_A_MAIN_PREZERO.input).toBeUndefined();
  });

  it('commits a photometry wavelength through the physical OK key', () => {
    const engine = createRuntimeEngine(project);
    engine.start('PHOT_IN_WL_IN');

    engine.pressButton(physicalButton('UI.K2').id);
    engine.pressButton(physicalButton('UI.DOT').id);
    engine.pressButton(physicalButton('UI.K5').id);
    expect(engine.inputSession?.value).toBe('2.5');

    engine.pressButton(physicalButton('UI.OK').id);
    expect(engine.currentStateId).toBe('3-4-2-photometry-input-wl-inputing-copy');
    expect(engine.lastInputCommit).toMatchObject({ stateId: 'PHOT_IN_WL_IN', value: '2.5' });
  });

  it('completes the multiwavelength count and wavelength-entry chain with the physical keypad', () => {
    const engine = createRuntimeEngine(project);
    const ok = physicalButton('UI.OK');
    engine.start('MUTLIWAVELENGTH_PAR_NUMBER_WL');

    engine.pressButton(ok.id);
    expect(engine.currentStateId).toBe('MUTLIWAVELENGTH_PAR_NUMBER_WL_IN');
    engine.pressButton(physicalButton('UI.K2').id);
    engine.pressButton(ok.id);
    expect(engine.currentStateId).toBe('MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_OK');

    engine.pressButton(ok.id);
    engine.pressButton(ok.id);
    expect(engine.currentStateId).toBe('MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_WL');
    engine.pressButton(physicalButton('UI.K5').id);
    engine.pressButton(ok.id);
    expect(engine.currentStateId).toBe('MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_WL_OK');

    for (const stateId of [
      'MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_2',
      'MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_3',
      'MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_4',
      'MUTLIWAVELENGTH_PAR_NEXT'
    ]) {
      engine.pressButton(ok.id);
      expect(engine.currentStateId).toBe(stateId);
    }
  });
});
