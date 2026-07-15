import { sha256Hex } from './sha256';

export type CodegenArtifactKind = 'c-header' | 'binary' | 'manifest' | 'report';

export interface CodegenArtifact {
  readonly kind: CodegenArtifactKind;
  readonly path: string;
  readonly mediaType: string;
  readonly content: string | Uint8Array;
  readonly byteLength: number;
  readonly sha256: string;
}

export interface CodegenArtifactSet {
  readonly artifacts: readonly CodegenArtifact[];
  readonly manifest: CodegenManifest;
}

export interface CodegenManifest {
  readonly schemaVersion: 1;
  readonly backendId: string;
  readonly targetProfileId: string;
  readonly sourceFingerprint?: string;
  readonly artifacts: readonly CodegenManifestArtifact[];
}

export interface CodegenManifestArtifact {
  readonly kind: CodegenArtifactKind;
  readonly path: string;
  readonly mediaType: string;
  readonly byteLength: number;
  readonly sha256: string;
}

export function createCodegenArtifact(
  kind: CodegenArtifactKind,
  path: string,
  mediaType: string,
  content: string | Uint8Array
): CodegenArtifact {
  return {
    kind,
    path,
    mediaType,
    content,
    byteLength: typeof content === 'string' ? new TextEncoder().encode(content).length : content.length,
    sha256: sha256Hex(content)
  };
}

export function createCodegenArtifactSet(
  backendId: string,
  targetProfileId: string,
  sourceFingerprint: string | undefined,
  artifacts: readonly CodegenArtifact[]
): CodegenArtifactSet {
  const manifest: CodegenManifest = {
    schemaVersion: 1,
    backendId,
    targetProfileId,
    sourceFingerprint,
    artifacts: artifacts.map((artifact) => ({
      kind: artifact.kind,
      path: artifact.path,
      mediaType: artifact.mediaType,
      byteLength: artifact.byteLength,
      sha256: artifact.sha256
    }))
  };
  return { artifacts, manifest };
}
