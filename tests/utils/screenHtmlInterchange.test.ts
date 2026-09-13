import { describe, expect, it } from 'vitest';
import { screenInterchangeToDslDocument } from '../../src/screen-dsl';
import { screenToScreenInterchangePackage } from '../../src/screen-interchange';
import { htmlToScreenDslDocument, screenInterchangeToHtml } from '../../src/screen-html';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';

describe('LCD HTML interchange', () => {
  const project = migrateLegacySnapshot(createDemoProject()).project;
  const screenId = project.screenOrder[0]!;
  const screenPackage = screenToScreenInterchangePackage(project, screenId);

  it('round-trips an LCD screen through deterministic declarative HTML', () => {
    const first = screenInterchangeToHtml(screenPackage);
    const second = screenInterchangeToHtml(screenPackage);
    const parsed = htmlToScreenDslDocument(first, screenPackage);

    expect(first).toBe(second);
    expect(first).toContain('data-lcd-format="lcd-bitmap-ide/html"');
    expect(first).toContain('data-lcd-width="128"');
    expect(parsed.diagnostics.filter((item) => item.severity === 'error')).toEqual([]);
    expect(parsed.document).toEqual(screenInterchangeToDslDocument(screenPackage));
  });

  it('rejects executable content instead of treating it as LCD layout', () => {
    const parsed = htmlToScreenDslDocument(
      `<section data-lcd-format="lcd-bitmap-ide/html" data-lcd-version="1" data-lcd-screen-id="${screenId}" data-lcd-width="128" data-lcd-height="64"><script>alert(1)</script></section>`,
      screenPackage
    );

    expect(parsed.document).toBeNull();
    expect(parsed.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'SCREEN_HTML_FORBIDDEN_ELEMENT', severity: 'error' })
    ]));
  });
});
