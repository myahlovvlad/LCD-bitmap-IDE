import type { ScreenDslImportMode } from '../../screen-dsl';
import type { ScreenDslTextFormat } from '../screenDsl/contracts';
import { fingerprintScreenDslJson } from '../screenDsl/hash';

export interface ScreenDslDocumentKey {
  readonly projectId: string;
  readonly format: ScreenDslTextFormat;
  readonly importMode: ScreenDslImportMode;
  /** Sorted, deduplicated. Empty for create mode. */
  readonly targetScreenIds: readonly string[];
}

export function createScreenDslDocumentKey(
  projectId: string,
  format: ScreenDslTextFormat,
  importMode: ScreenDslImportMode,
  targetScreenIds: readonly string[] = []
): ScreenDslDocumentKey {
  const sorted = [...new Set(targetScreenIds)].sort();
  return { projectId, format, importMode, targetScreenIds: sorted };
}

export function screenDslDocumentKeyEquals(a: ScreenDslDocumentKey, b: ScreenDslDocumentKey): boolean {
  return (
    a.projectId === b.projectId &&
    a.format === b.format &&
    a.importMode === b.importMode &&
    a.targetScreenIds.length === b.targetScreenIds.length &&
    a.targetScreenIds.every((id, index) => id === b.targetScreenIds[index])
  );
}

export function serializeScreenDslDocumentKey(key: ScreenDslDocumentKey): string {
  return fingerprintScreenDslJson({
    projectId: key.projectId,
    format: key.format,
    importMode: key.importMode,
    targetScreenIds: key.targetScreenIds
  });
}
