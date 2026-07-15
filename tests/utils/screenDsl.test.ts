import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import { projectToScreenInterchange } from '../../src/screen-interchange';
import {
  diffScreenInterchange,
  parseScreenDslJson,
  parseScreenDslYaml,
  screenDslDocumentToInterchange,
  screenInterchangeToDslDocument,
  validateScreenDslDocument,
  writeCanonicalScreenDslJson,
  writeCanonicalScreenDslYaml
} from '../../src/screen-dsl';

describe('Screen DSL V1', () => {
  it('round-trips Screen Interchange through canonical JSON', () => {
    const interchange = projectToScreenInterchange(demoProject());
    const document = screenInterchangeToDslDocument(interchange);
    const json = writeCanonicalScreenDslJson(document);
    const parsed = parseScreenDslJson(json);

    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.document).not.toBeNull();
    expect(screenDslDocumentToInterchange(parsed.document!)).toEqual(screenDslDocumentToInterchange(document));
  });

  it('round-trips canonical YAML without enabling general YAML features', () => {
    const document = screenInterchangeToDslDocument(projectToScreenInterchange(demoProject(), { screenIds: ['main-menu'] }));
    const yaml = writeCanonicalScreenDslYaml(document);
    const parsed = parseScreenDslYaml(yaml);

    expect(yaml).toContain('format: lcd-bitmap-ide/screen');
    expect(parsed.ok).toBe(true);
    expect(parsed.document?.screens.map((screen) => screen.id)).toEqual(['main-menu']);
  });

  it('rejects unsupported layout modes instead of invoking a layout compiler', () => {
    const document = screenInterchangeToDslDocument(projectToScreenInterchange(demoProject(), { screenIds: ['main-menu'] }));
    const json = JSON.stringify({ ...document, layoutMode: 'grid' });
    const parsed = parseScreenDslJson(json);

    expect(parsed.ok).toBe(false);
    expect(parsed.diagnostics.some((diagnostic) => diagnostic.code === 'SCREEN_DSL_UNSUPPORTED_LAYOUT_MODE')).toBe(true);
  });

  it('keeps semantic diff identity-aware for object updates', () => {
    const before = projectToScreenInterchange(demoProject(), { screenIds: ['main-menu'] });
    const afterDocument = screenInterchangeToDslDocument(before);
    const firstObject = afterDocument.screens[0].objects[0];
    const after = screenDslDocumentToInterchange({
      ...afterDocument,
      screens: [{
        ...afterDocument.screens[0],
        objects: [{ ...firstObject, x: firstObject.kind === 'text' ? firstObject.x + 1 : 1 }, ...afterDocument.screens[0].objects.slice(1)]
      }]
    });

    expect(diffScreenInterchange(before, after).operations.map((operation) => operation.type))
      .toContain('object.update');
    expect(diffScreenInterchange(before, after).operations.map((operation) => operation.type))
      .not.toContain('object.delete');
  });

  it('validates resource references and object ordering', () => {
    const document = screenInterchangeToDslDocument(projectToScreenInterchange(demoProject(), { screenIds: ['main-menu'] }));
    const broken = {
      ...document,
      screens: [{
        ...document.screens[0],
        objectOrder: ['wrong-id'],
        objects: [{ ...document.screens[0].objects[0], resourceRefs: ['missing:resource'] }]
      }]
    };
    const result = validateScreenDslDocument(broken);

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain('SCREEN_DSL_OBJECT_ORDER_MISMATCH');
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain('SCREEN_DSL_MISSING_RESOURCE');
  });
});

function demoProject() {
  return migrateLegacySnapshot(createDemoProject()).project;
}
