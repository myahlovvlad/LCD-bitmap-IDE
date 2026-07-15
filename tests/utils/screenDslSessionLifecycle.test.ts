import { describe, expect, it } from 'vitest';
import {
  applyScreenDslPreview,
  createProjectSession,
  createScreenDslPreview,
  exportScreenDsl
} from '../../src/application';
import {
  ScreenDslSessionCoordinator
} from '../../src/application/screenDslSession/coordinator';
import { createScreenDslDocumentKey } from '../../src/application/screenDslSession/identity';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';

const actor = { id: 'session-lifecycle-test', type: 'system' as const };

function demoSession() {
  return createProjectSession(migrateLegacySnapshot(createDemoProject()).project, 0);
}

describe('Screen DSL session lifecycle', () => {
  it('creates independent sessions for YAML and JSON formats', () => {
    const coord = new ScreenDslSessionCoordinator({ actor });
    const jsonKey = createScreenDslDocumentKey('proj-1', 'json', 'create', []);
    const yamlKey = createScreenDslDocumentKey('proj-1', 'yaml', 'create', []);
    const json = coord.getOrCreate('proj-1', 'json', 'create');
    const yaml = coord.getOrCreate('proj-1', 'yaml', 'create');

    expect(json).not.toBe(yaml);
    expect(json.key.format).toBe('json');
    expect(yaml.key.format).toBe('yaml');
  });

  it('create/update/clone sessions are independent', () => {
    const coord = new ScreenDslSessionCoordinator({ actor });
    const create = coord.getOrCreate('proj-1', 'json', 'create');
    const update = coord.getOrCreate('proj-1', 'json', 'update', ['s1']);
    const clone = coord.getOrCreate('proj-1', 'json', 'clone', ['s1']);

    expect(create).not.toBe(update);
    expect(update).not.toBe(clone);
    expect(create.key.importMode).toBe('create');
    expect(update.key.importMode).toBe('update');
    expect(clone.key.importMode).toBe('clone');
  });

  it('source update preserves draft under same key', () => {
    const coord = new ScreenDslSessionCoordinator({ actor });
    const key = createScreenDslDocumentKey('proj-1', 'json', 'create', []);
    coord.getOrCreate('proj-1', 'json', 'create');
    coord.updateSource(key, 'my draft\n');
    const session = coord.getSession(key);

    expect(session?.sourceText).toBe('my draft\n');
    expect(session?.dirty).toBe(true);
  });

  it('target selection change does not affect sessions under old key', () => {
    const coord = new ScreenDslSessionCoordinator({ actor });
    const key1 = createScreenDslDocumentKey('proj-1', 'json', 'update', ['screen-a']);
    const key2 = createScreenDslDocumentKey('proj-1', 'json', 'update', ['screen-b']);
    coord.updateSource(key1, 'draft-a\n');
    const s1 = coord.getSession(key1);
    const s2 = coord.getOrCreate('proj-1', 'json', 'update', ['screen-b']);

    expect(s1?.sourceText).toBe('draft-a\n');
    expect(s2.key).not.toEqual(key1);
  });

  it('initialize produces clean session with canonical source', () => {
    const coord = new ScreenDslSessionCoordinator({ actor });
    const projectSession = demoSession();
    const sid = projectSession.project.screenOrder[0];
    const canonical = exportScreenDsl(projectSession, 'json', [sid]);
    const key = createScreenDslDocumentKey(projectSession.project.meta.id, 'json', 'update', [sid]);
    const session = coord.initialize(projectSession, 'json', 'update', [sid], canonical);

    expect(session.status).toBe('clean');
    expect(session.dirty).toBe(false);
    expect(session.sourceText).toBe(canonical);
    expect(session.baseRevision).toBe(0);
  });

  it('dispose marks session disposed', () => {
    const coord = new ScreenDslSessionCoordinator({ actor });
    const key = createScreenDslDocumentKey('proj-1', 'json', 'create', []);
    coord.getOrCreate('proj-1', 'json', 'create');
    coord.dispose(key);
    const session = coord.getSession(key);

    expect(session?.disposed).toBe(true);
  });

  it('discard draft restores canonical source', () => {
    const coord = new ScreenDslSessionCoordinator({ actor });
    const key = createScreenDslDocumentKey('proj-1', 'json', 'create', []);
    const canonical = 'canonical\n';
    coord.getOrCreate('proj-1', 'json', 'create');
    coord.updateSource(key, 'dirty draft\n');
    coord.discardDraft(key, canonical);
    const session = coord.getSession(key);

    expect(session?.dirty).toBe(false);
    expect(session?.status).toBe('clean');
    expect(session?.sourceText).toBe(canonical);
  });

  it('project switch via notifyProjectChanged invalidates preview', () => {
    const coord = new ScreenDslSessionCoordinator({ actor });
    const key = createScreenDslDocumentKey('proj-1', 'json', 'create', []);
    coord.getOrCreate('proj-1', 'json', 'create');
    coord.notifyProjectChanged(key, 1, 'new-fp', null);
    const session = coord.getSession(key);

    expect(session?.preview).toBeNull();
    expect(session?.staleReason).toBeDefined();
  });

  it('session draft is not stored in project — project serialization is unchanged', () => {
    // The document session is entirely in-memory; .lcdproj serialization is project-only
    const projectSession = demoSession();
    const coord = new ScreenDslSessionCoordinator({ actor });
    const key = createScreenDslDocumentKey(projectSession.project.meta.id, 'json', 'create', []);
    coord.updateSource(key, 'unsaved draft text\n');
    // The project itself has no draft field
    expect((projectSession.project as Record<string, unknown>)['dslDraft']).toBeUndefined();
    expect(JSON.stringify(projectSession.project)).not.toContain('unsaved draft text');
  });

  it('multiple getAllSessions returns all tracked sessions', () => {
    const coord = new ScreenDslSessionCoordinator({ actor });
    coord.getOrCreate('proj-1', 'json', 'create');
    coord.getOrCreate('proj-1', 'yaml', 'create');
    coord.getOrCreate('proj-1', 'json', 'update', ['s1']);

    expect(coord.getAllSessions()).toHaveLength(3);
  });
});
