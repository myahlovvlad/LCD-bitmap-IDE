import { describe, expect, it } from 'vitest';
import { createProjectSession, exportSessionScreenInterchange, exportSessionScreenInterchangeScreen } from '../../src/application';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';

describe('screen interchange application facade', () => {
  it('exports a read-only project model without changing session revision or history', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const session = createProjectSession(project, 12);
    const before = JSON.stringify(session);
    const result = exportSessionScreenInterchange(session);

    expect(result.validation.ok).toBe(true);
    expect(result.package.screens).toHaveLength(project.screenOrder.length);
    expect(result.canonicalJson.endsWith('\n')).toBe(true);
    expect(result.fingerprint).toMatch(/^simv1-[0-9a-f]{16}$/);
    expect(session.revision).toBe(12);
    expect(session.history.entries).toEqual([]);
    expect(JSON.stringify(session)).toBe(before);
  });

  it('exports a single-screen package through the same read-only path', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const session = createProjectSession(project, 0);
    const result = exportSessionScreenInterchangeScreen(session, 'measure');

    expect(result.validation.ok).toBe(true);
    expect(result.package.project.screenOrder).toEqual(['measure']);
    expect(result.package.screens.map((screen) => screen.id)).toEqual(['measure']);
    expect(result.package.traceability.screens.measure.linkedStateIds).toEqual(['measure']);
  });
});
