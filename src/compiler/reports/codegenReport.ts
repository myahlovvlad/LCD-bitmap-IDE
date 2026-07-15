import type { CodegenArtifactSet } from '../artifacts/codegenArtifacts';
import type { LoweredTargetIrV1 } from '../target-ir/targetIr';

export interface CodegenReport {
  readonly targetProfileId: string;
  readonly sourceFingerprint?: string;
  readonly screenCount: number;
  readonly totalScreenBytes: number;
  readonly artifacts: CodegenArtifactSet['manifest']['artifacts'];
}

export function createCodegenReport(targetIr: LoweredTargetIrV1, artifacts: CodegenArtifactSet): CodegenReport {
  return {
    targetProfileId: targetIr.targetProfile.id,
    sourceFingerprint: targetIr.sourceFingerprint,
    screenCount: targetIr.memory.screenCount,
    totalScreenBytes: targetIr.memory.totalScreenBytes,
    artifacts: artifacts.manifest.artifacts
  };
}
