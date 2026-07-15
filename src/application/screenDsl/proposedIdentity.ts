import type { ProjectSession } from '../projectSession';
import type { ScreenDslDocumentV1, ScreenDslImportMode } from '../../screen-dsl';
import type { ScreenDslIdentityPlan } from './contracts';
import { fingerprintScreenDslJson } from './hash';

export function createScreenDslIdentityPlan(
  session: ProjectSession,
  document: ScreenDslDocumentV1,
  importMode: ScreenDslImportMode,
  sourceFingerprint: string
): ScreenDslIdentityPlan {
  const screens: Record<string, string> = {};
  const objects: Record<string, string> = {};
  const resources: Record<string, string> = {};

  for (const screen of document.screens) {
    screens[screen.id] = importMode === 'clone'
      ? uniqueId(session.project.screens, `${screen.id}-copy`)
      : screen.id;
    for (const object of screen.objects) {
      objects[`${screen.id}:${object.id}`] = importMode === 'clone'
        ? `${screens[screen.id]}-${object.kind}-${object.order + 1}`
        : object.id;
    }
  }

  for (const ref of [
    ...Object.keys(document.resources.fonts),
    ...Object.keys(document.resources.glyphs),
    ...Object.keys(document.resources.bitmaps)
  ]) {
    resources[ref] = importMode === 'clone' ? `${ref}:copy` : ref;
  }

  return {
    screens,
    objects,
    resources,
    fingerprint: fingerprintScreenDslJson({
      projectId: session.project.meta.id,
      revision: session.revision,
      importMode,
      sourceFingerprint,
      screens,
      objects,
      resources
    })
  };
}

function uniqueId(record: Record<string, unknown>, prefix: string): string {
  const base = slug(prefix);
  let id = base;
  let suffix = 2;
  while (record[id]) {
    id = `${base}-${suffix++}`;
  }
  return id;
}

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'screen';
}
