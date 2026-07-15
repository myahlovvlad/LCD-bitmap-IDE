import type { ProjectChangeSet } from '../changeSet';
import type { ProjectCommandResult } from '../commandBus';
import type { ActorIdentity } from '../commandTypes';
import type { ScreenInterchangeProjectV1 } from '../../screen-interchange';
import type {
  ScreenDslDiagnostic,
  ScreenDslDocumentV1,
  ScreenDslImportMode,
  ScreenDslSemanticDiff
} from '../../screen-dsl';
import type { ScreenDslPreviewLifecycle } from './transactionContract';

export type ScreenDslTextFormat = 'json' | 'yaml';

export interface CreateScreenDslPreviewRequest {
  projectId: string;
  expectedRevision: number;
  format: ScreenDslTextFormat;
  sourceText: string;
  importMode: ScreenDslImportMode;
  targetScreenIds?: readonly string[];
  actor: ActorIdentity;
}

export interface ScreenDslIdentityPlan {
  screens: Readonly<Record<string, string>>;
  objects: Readonly<Record<string, string>>;
  resources: Readonly<Record<string, string>>;
  fingerprint: string;
}

export interface ScreenDslRasterPreview {
  beforeByteLength: number;
  afterByteLength: number;
  changedScreens: readonly string[];
}

export interface ScreenDslPreviewResult {
  success: boolean;
  projectId: string;
  importMode: ScreenDslImportMode;
  baseRevision: number;
  baseScreenFingerprint: string;
  sourceFingerprint: string;
  parsedDocument: ScreenDslDocumentV1 | null;
  interchangeCandidate: ScreenInterchangeProjectV1 | null;
  identityPlan: ScreenDslIdentityPlan | null;
  semanticDiff: ScreenDslSemanticDiff | null;
  changeSet: ProjectChangeSet | null;
  dryRun: ProjectCommandResult | null;
  rasterPreview: ScreenDslRasterPreview | null;
  diagnostics: readonly ScreenDslDiagnostic[];
  destructive: boolean;
  applyAllowed: boolean;
  /** Lifecycle state of this preview. Immutable after creation; use updatedPreview from ApplyScreenDslPreviewResult. */
  lifecycle: ScreenDslPreviewLifecycle;
}

export interface ApplyScreenDslPreviewRequest {
  preview: ScreenDslPreviewResult;
  sourceText: string;
  confirmDestructive?: boolean;
}
