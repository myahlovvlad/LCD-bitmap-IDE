import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../../src/entities/project/demo';
import {
  createProjectFileV5,
  migrateLegacySnapshot,
  migrateProject
} from '../../src/services/projectMigrationService';
import { createLcdProjectPayload } from '../../src/services/projectInterop';
import { createMutableFontGlyphs } from '../../src/domain/fonts';
import { PROJECT_SCHEMA_VERSION } from '../../src/domain/project';

describe('v5 project migration', () => {
  it('separates legacy states and screens and creates events and buttons', () => {
    const legacy = createDemoProject();
    const snapshot = migrateLegacySnapshot(legacy);

    expect(snapshot.project.meta.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(snapshot.project.fsm.states['main-menu'].screenId).toBe('main-menu');
    expect(snapshot.project.screens['main-menu'].objects.length).toBeGreaterThan(0);
    expect(snapshot.project.fsm.events.START.name).toBe('START');
    expect(snapshot.project.fsm.transitions['tr-main-measure'].trigger.eventId).toBe('START');

    const startButton = Object.values(snapshot.project.controlPanel.elements)
      .find((element) => element.type === 'button' && element.fsmEventId === 'START');
    expect(startButton).toBeTruthy();
  });

  it('migrates transition commands into backend processes', () => {
    const legacy = createDemoProject();
    legacy.project.transitions['tr-main-measure'].cliCommands = ['MEASURE:START'];
    const snapshot = migrateLegacySnapshot(legacy);
    const transition = snapshot.project.fsm.transitions['tr-main-measure'];

    expect(transition.backendProcessId).toBe('process-tr-main-measure');
    expect(snapshot.project.backendProcesses[transition.backendProcessId!].commands).toEqual(['MEASURE:START']);
  });

  it('round-trips a v5 project file', () => {
    const snapshot = migrateLegacySnapshot(createDemoProject());
    const payload = createProjectFileV5(snapshot, 'en');
    const restored = migrateProject(payload);

    expect(restored.project.meta.id).toBe(snapshot.project.meta.id);
    expect(restored.project.fsm.eventOrder).toEqual(snapshot.project.fsm.eventOrder);
    expect(restored.project.controlPanel.elementOrder.length).toBeGreaterThan(1);
  });

  it('preserves IDs and screen references across a v5 import', () => {
    const snapshot = migrateLegacySnapshot(createDemoProject());
    const payload = createProjectFileV5(snapshot, 'en');
    const restored = migrateProject(payload);

    expect(restored.project.screenOrder).toEqual(snapshot.project.screenOrder);
    expect(restored.project.fsm.stateOrder).toEqual(snapshot.project.fsm.stateOrder);
    expect(restored.project.fsm.transitionOrder).toEqual(snapshot.project.fsm.transitionOrder);
    expect(restored.project.fsm.states['main-menu'].screenId).toBe('main-menu');
  });

  it('continues to import portable lcdproj payloads', () => {
    const legacy = createDemoProject();
    const payload = createLcdProjectPayload({
      project: legacy.project,
      stateOrder: legacy.stateOrder,
      transitionOrder: legacy.transitionOrder,
      fontGlyphs: createMutableFontGlyphs()
    });
    const restored = migrateProject(payload);

    expect(restored.project.meta.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(restored.project.meta.id).toBe(legacy.project.id);
    expect(restored.project.screenOrder).toContain('main-menu');
    expect(restored.project.screens['main-menu'].objects[0]?.id).toBe('main-title');
  });
});
