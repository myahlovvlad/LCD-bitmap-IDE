import type { CodegenArtifactSet } from '../artifacts/codegenArtifacts';

export interface CodegenEquivalenceResult {
  readonly pass: boolean;
  readonly mismatches: readonly CodegenEquivalenceMismatch[];
}

export interface CodegenEquivalenceMismatch {
  readonly path: string;
  readonly reason: string;
  readonly expectedSha256?: string;
  readonly actualSha256?: string;
}

export function compareArtifactSets(expected: CodegenArtifactSet, actual: CodegenArtifactSet): CodegenEquivalenceResult {
  const mismatches: CodegenEquivalenceMismatch[] = [];
  const expectedByPath = new Map(expected.artifacts.map((artifact) => [artifact.path, artifact]));
  const actualByPath = new Map(actual.artifacts.map((artifact) => [artifact.path, artifact]));

  for (const [path, expectedArtifact] of expectedByPath) {
    const actualArtifact = actualByPath.get(path);
    if (!actualArtifact) {
      mismatches.push({ path, reason: 'missing actual artifact', expectedSha256: expectedArtifact.sha256 });
      continue;
    }
    if (expectedArtifact.sha256 !== actualArtifact.sha256 || expectedArtifact.byteLength !== actualArtifact.byteLength) {
      mismatches.push({
        path,
        reason: 'artifact content differs',
        expectedSha256: expectedArtifact.sha256,
        actualSha256: actualArtifact.sha256
      });
    }
  }

  for (const [path, actualArtifact] of actualByPath) {
    if (!expectedByPath.has(path)) {
      mismatches.push({ path, reason: 'unexpected actual artifact', actualSha256: actualArtifact.sha256 });
    }
  }

  return { pass: mismatches.length === 0, mismatches };
}
