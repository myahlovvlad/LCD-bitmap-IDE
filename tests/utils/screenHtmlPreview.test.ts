import { describe, expect, it } from 'vitest';
import { createProjectSession, exportSessionScreenInterchange } from '../../src/application';
import { createScreenHtmlPreview } from '../../src/application/screenHtml';
import { screenInterchangeToHtml } from '../../src/screen-html';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';

describe('HTML screen import preview', () => {
  it('validates an unchanged HTML screen without changing the session', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const session = createProjectSession(project, 0);
    const html = screenInterchangeToHtml(exportSessionScreenInterchange(session).package, project.screenOrder[0]);

    const preview = createScreenHtmlPreview(session, {
      html,
      importMode: 'update',
      expectedRevision: session.revision
    });

    expect(preview.diagnostics.filter((item) => item.severity === 'error')).toEqual([]);
    expect(preview.success).toBe(true);
    expect(preview.screenDslPreview?.applyAllowed).toBe(true);
    expect(session.revision).toBe(0);
    expect(session.history.entries).toEqual([]);
  });
});
