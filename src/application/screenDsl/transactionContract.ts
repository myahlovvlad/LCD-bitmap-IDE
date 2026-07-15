import type { ScreenDslImportMode } from '../../screen-dsl';
import type { ScreenDslIdentityPlan, ScreenDslPreviewResult } from './contracts';
import { fingerprintScreenDslJson } from './hash';

export type ScreenDslPreviewLifecycle =
  | 'current'
  | 'stale'
  | 'applying'
  | 'consumed'
  | 'failed';

export type ScreenDslApplyTransactionStatus =
  | 'prepared'
  | 'validating'
  | 'applying'
  | 'committed'
  | 'rolled-back'
  | 'rejected'
  | 'consumed';

export interface CreateScreensOperation {
  type: 'create-screens';
  operationId: string;
  screenIds: readonly string[];
  objectIds: readonly string[];
  resourceIds: readonly string[];
  mode: 'create' | 'clone';
  destructive: false;
  dependsOn: readonly string[];
  orderKey: string;
}

export interface UpdateScreenNameOperation {
  type: 'update-screen-name';
  operationId: string;
  screenId: string;
  previousName: string;
  nextName: string;
  destructive: false;
  dependsOn: readonly string[];
  orderKey: string;
}

export interface UpdateScreenDimensionsOperation {
  type: 'update-screen-dimensions';
  operationId: string;
  screenId: string;
  previousWidth: number;
  previousHeight: number;
  nextWidth: number;
  nextHeight: number;
  destructive: false;
  dependsOn: readonly string[];
  orderKey: string;
}

export interface UpdateScreenObjectsOperation {
  type: 'update-screen-objects';
  operationId: string;
  screenId: string;
  objectIds: readonly string[];
  destructive: boolean;
  dependsOn: readonly string[];
  orderKey: string;
}

export type ScreenDslApplyOperation =
  | CreateScreensOperation
  | UpdateScreenNameOperation
  | UpdateScreenDimensionsOperation
  | UpdateScreenObjectsOperation;

export interface ScreenDslApplyTransaction {
  id: string;
  projectId: string;
  importMode: ScreenDslImportMode;
  expectedRevision: number;
  baseScreenFingerprint: string;
  sourceFingerprint: string;
  identityPlanFingerprint: string;
  operations: readonly ScreenDslApplyOperation[];
  destructive: boolean;
  fingerprint: string;
}

export const SCREEN_DSL_TRANSACTION_LIMITS = {
  maxOperations: 200,
  maxAffectedScreens: 20,
  maxAffectedObjects: 1000,
  maxCreatedResources: 200,
  maxDiagnostics: 100
} as const;

export function computeScreenDslTransactionFingerprint(
  projectId: string,
  importMode: ScreenDslImportMode,
  baseRevision: number,
  baseScreenFingerprint: string,
  sourceFingerprint: string,
  identityPlanFingerprint: string,
  operations: readonly ScreenDslApplyOperation[],
  destructive: boolean
): string {
  return fingerprintScreenDslJson({
    projectId,
    importMode,
    baseRevision,
    baseScreenFingerprint,
    sourceFingerprint,
    identityPlanFingerprint,
    operations: operations.map((operation) => ({
      type: operation.type,
      operationId: operation.operationId,
      orderKey: operation.orderKey
    })),
    destructive
  });
}

export function buildScreenDslApplyTransaction(
  preview: ScreenDslPreviewResult,
  operations: readonly ScreenDslApplyOperation[]
): ScreenDslApplyTransaction {
  const identityPlanFingerprint = preview.identityPlan?.fingerprint ?? '';
  const fingerprint = computeScreenDslTransactionFingerprint(
    preview.projectId,
    preview.importMode,
    preview.baseRevision,
    preview.baseScreenFingerprint,
    preview.sourceFingerprint,
    identityPlanFingerprint,
    operations,
    preview.destructive
  );
  return {
    id: fingerprint,
    projectId: preview.projectId,
    importMode: preview.importMode,
    expectedRevision: preview.baseRevision,
    baseScreenFingerprint: preview.baseScreenFingerprint,
    sourceFingerprint: preview.sourceFingerprint,
    identityPlanFingerprint,
    operations,
    destructive: preview.destructive,
    fingerprint
  };
}

export function buildScreenDslApplyOperations(
  preview: ScreenDslPreviewResult
): readonly ScreenDslApplyOperation[] {
  if (!preview.changeSet) {
    return [];
  }
  const operations: ScreenDslApplyOperation[] = [];
  for (let index = 0; index < preview.changeSet.commands.length; index++) {
    const command = preview.changeSet.commands[index];
    const orderKey = String(index).padStart(6, '0');
    if (command.type === 'screen.dsl.apply') {
      const plan: ScreenDslIdentityPlan = preview.identityPlan ?? { screens: {}, objects: {}, resources: {}, fingerprint: '' };
      const screenIds = Object.values(plan.screens);
      const objectIds = Object.values(plan.objects);
      const resourceIds = Object.values(plan.resources);
      operations.push({
        type: 'create-screens',
        operationId: command.meta.commandId,
        screenIds,
        objectIds,
        resourceIds,
        mode: command.payload.mode,
        destructive: false,
        dependsOn: [],
        orderKey
      });
    } else if (command.type === 'screen.rename') {
      const screenId = command.payload.screenId;
      const prevScreen = preview.changeSet?.commands.find(
        (cmd) => cmd.type === 'screen.rename' && cmd.payload.screenId === screenId
      );
      operations.push({
        type: 'update-screen-name',
        operationId: command.meta.commandId,
        screenId,
        previousName: '',
        nextName: command.payload.name,
        destructive: false,
        dependsOn: [],
        orderKey
      });
    } else if (command.type === 'screen.resize') {
      operations.push({
        type: 'update-screen-dimensions',
        operationId: command.meta.commandId,
        screenId: command.payload.screenId,
        previousWidth: 0,
        previousHeight: 0,
        nextWidth: command.payload.width,
        nextHeight: command.payload.height,
        destructive: false,
        dependsOn: [],
        orderKey
      });
    } else if (command.type === 'canvas.objects.update') {
      operations.push({
        type: 'update-screen-objects',
        operationId: command.meta.commandId,
        screenId: command.payload.screenId,
        objectIds: command.payload.objects.map((object) => object.id),
        destructive: preview.destructive,
        dependsOn: [],
        orderKey
      });
    }
  }
  return operations;
}
