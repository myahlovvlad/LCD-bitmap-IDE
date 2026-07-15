import { describe, expect, it } from 'vitest';
import {
  createCompilerSourceFromWorkspace,
  createProjectSession
} from '../../src/application';
import {
  canonicalSerializeValue,
  createCompilerSourceSnapshot,
  normalizeProject
} from '../../src/compiler';
import { createDemoProject } from '../../src/entities/project/demo';
import { createBlankProject } from '../../src/entities/project/factory';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import type { LcdBitmapProject } from '../../src/domain';

describe('normalized compiler IR v1', () => {
  it('normalizes the demo project into deterministic versioned IR with traceability', () => {
    const project = demoProject();
    const source = createCompilerSourceSnapshot({ project, requestedLocales: ['en', 'ru', 'zh'] });

    const first = normalizeProject(source);
    const second = normalizeProject(createCompilerSourceSnapshot({ project, requestedLocales: ['en', 'ru', 'zh'] }));

    expect(first.ir.irVersion).toBe(1);
    expect(first.ir.source.projectId).toBe(project.meta.id);
    expect(first.ir.display).toEqual({ width: 128, height: 64, colorMode: 'monochrome', packing: 'vertical-lsb', byteLength: 1024 });
    expect(first.ir.screens.map((screen) => screen.id)).toEqual(project.screenOrder);
    expect(first.ir.fsm.states.map((state) => state.id)).toEqual(project.fsm.stateOrder);
    expect(first.completeness).toEqual(expect.objectContaining({
      screenCount: 5,
      stateCount: 5,
      transitionCount: 4
    }));
    expect(first.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
    expect(first.ir.traceability.links.some((link) => link.sourceType === 'screen' && link.sourceId === 'main-menu')).toBe(true);
    expect(first.canonicalJson).toBe(second.canonicalJson);
    expect(first.fingerprint).toBe(second.fingerprint);
  });

  it('does not let dictionary insertion order change canonical IR', () => {
    const project = demoProject();
    const reordered: LcdBitmapProject = {
      ...project,
      screens: reverseRecord(project.screens),
      fsm: {
        ...project.fsm,
        states: reverseRecord(project.fsm.states),
        events: reverseRecord(project.fsm.events),
        transitions: reverseRecord(project.fsm.transitions)
      }
    };

    const first = normalizeProject(createCompilerSourceSnapshot({ project }));
    const second = normalizeProject(createCompilerSourceSnapshot({ project: reordered }));

    expect(second.ir.screens.map((screen) => screen.id)).toEqual(first.ir.screens.map((screen) => screen.id));
    expect(second.ir.fsm.transitions.map((transition) => transition.id)).toEqual(first.ir.fsm.transitions.map((transition) => transition.id));
    expect(second.fingerprint).toBe(first.fingerprint);
  });

  it('does let explicit order change IR order and fingerprint', () => {
    const project = demoProject();
    const reordered: LcdBitmapProject = {
      ...project,
      screenOrder: [...project.screenOrder].reverse()
    };

    const first = normalizeProject(createCompilerSourceSnapshot({ project }));
    const second = normalizeProject(createCompilerSourceSnapshot({ project: reordered }));

    expect(second.ir.screens.map((screen) => screen.id)).toEqual([...project.screenOrder].reverse());
    expect(second.fingerprint).not.toBe(first.fingerprint);
  });

  it('excludes validation timestamps and application session runtime state from source fingerprints', () => {
    const project = demoProject();
    const withNewValidationTime: LcdBitmapProject = {
      ...project,
      validation: { ...project.validation, validatedAt: '2099-01-01T00:00:00.000Z' }
    };
    const session = createProjectSession({
      project,
      savedMeasurements: [{
        id: 'measurement-1',
        stateId: project.fsm.stateOrder[0],
        label: 'Voltage',
        value: '3.3V',
        note: '',
        createdAt: '2026-06-24T00:00:00.000Z',
        updatedAt: '2026-06-24T00:00:00.000Z'
      }]
    }, 42);

    const sourceFromProject = createCompilerSourceSnapshot({ project });
    const sourceWithNewValidationTime = createCompilerSourceSnapshot({ project: withNewValidationTime });
    const sourceFromWorkspace = createCompilerSourceFromWorkspace(session.workspace);

    expect(sourceWithNewValidationTime.sourceFingerprint).toBe(sourceFromProject.sourceFingerprint);
    expect(sourceFromWorkspace.sourceFingerprint).not.toContain('42');
    expect(sourceFromWorkspace.savedMeasurements).toHaveLength(1);
    expect('history' in sourceFromWorkspace).toBe(false);
    expect('revision' in sourceFromWorkspace).toBe(false);
  });

  it('reports current symbol collisions without de-duplicating legacy names', () => {
    const project = demoProject();
    const firstScreen = project.screens[project.screenOrder[0]];
    const secondScreenId = project.screenOrder[1];
    const collisionProject: LcdBitmapProject = {
      ...project,
      screens: {
        ...project.screens,
        [secondScreenId]: { ...project.screens[secondScreenId], name: firstScreen.name }
      }
    };

    const result = normalizeProject(createCompilerSourceSnapshot({ project: collisionProject }));

    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'compiler.source.symbol-collision')).toBe(true);
    expect(result.ir.symbols.collisions.length).toBeGreaterThanOrEqual(2);
  });

  it('serializes arbitrary values canonically', () => {
    expect(canonicalSerializeValue({ b: 2, a: { d: 4, c: 3 } }))
      .toBe(canonicalSerializeValue({ a: { c: 3, d: 4 }, b: 2 }));
  });
});

function demoProject(): LcdBitmapProject {
  return migrateLegacySnapshot(createDemoProject()).project;
}

function reverseRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).reverse());
}
