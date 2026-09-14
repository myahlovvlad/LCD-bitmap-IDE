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
    snapshot.project.authoringLanguage = 'ru';
    const payload = createProjectFileV5(snapshot, 'en');
    const restored = migrateProject(payload);

    expect(restored.project.meta.id).toBe(snapshot.project.meta.id);
    expect(restored.project.fsm.eventOrder).toEqual(snapshot.project.fsm.eventOrder);
    expect(restored.project.controlPanel.elementOrder.length).toBeGreaterThan(1);
    expect(restored.project.authoringLanguage).toBe('ru');
  });

  it('defaults legacy project content language without changing the interface language', () => {
    const restored = migrateLegacySnapshot({ ...createDemoProject(), language: 'zh' });

    expect(restored.language).toBe('zh');
    expect(restored.project.authoringLanguage).toBe('en');
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

  it('migrates projects with no animation field to an empty catalog', () => {
    const snapshot = migrateLegacySnapshot(createDemoProject());
    const legacyProject = { ...snapshot.project } as Record<string, unknown>;
    delete legacyProject.animations;

    expect(migrateProject(legacyProject).project.animations).toEqual({ resources: {}, order: [] });
  });

  it('removes a binding to a resource missing after migration', () => {
    const snapshot = migrateLegacySnapshot(createDemoProject());
    const screen = snapshot.project.screens['main-menu'];
    const project = {
      ...snapshot.project,
      screens: {
        ...snapshot.project.screens,
        'main-menu': { ...screen, animationId: 'missing-animation' }
      }
    };

    expect(migrateProject(project).project.screens['main-menu'].animationId).toBeNull();
  });

  it('normalizes animation resources, order, duration and object bindings', () => {
    const snapshot = migrateLegacySnapshot(createDemoProject());
    const screen = snapshot.project.screens['main-menu'];
    const project = {
      ...snapshot.project,
      animations: {
        resources: {
          spinner: {
            id: 'spinner', name: 'Spinner', width: 8, height: 8, loop: true,
            frames: [{ id: 'frame', bytes: [0], durationMs: 0 }]
          }
        },
        order: ['missing', 'spinner', 'spinner']
      },
      screens: {
        ...snapshot.project.screens,
        'main-menu': {
          ...screen,
          objects: [{
            id: 'bitmap', type: 'bitmap', name: 'Animated bitmap', x: 0, y: 0, width: 8, height: 8,
            bytes: [0], zIndex: 1, visible: true, locked: false, source: 'user', animationId: 'missing'
          }]
        }
      }
    };
    const migrated = migrateProject(project).project;

    expect(migrated.animations.order).toEqual(['spinner']);
    expect(migrated.animations.resources.spinner.frames[0].durationMs).toBe(1);
    expect(migrated.screens['main-menu'].objects[0].type === 'bitmap' && migrated.screens['main-menu'].objects[0].animationId).toBeNull();
  });
});
