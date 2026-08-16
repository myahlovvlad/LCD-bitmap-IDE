export type AutomationAccess = 'read' | 'write' | 'destructive';
export type AutomationSource = 'ui' | 'electron-rest' | 'electron-mcp' | 'tauri-rest' | 'tauri-mcp' | 'test';
export type AutomationOutcomeStatus = 'success' | 'failure' | 'cancelled' | 'blocked' | 'conflict' | 'noop';
export type JsonSchema = Record<string, unknown>;

export interface AutomationActorIdentity {
  id: string;
  type: 'user' | 'system' | 'adapter';
  displayName?: string;
}

export interface AutomationSemanticChange {
  kind: 'created' | 'updated' | 'deleted';
  entityType: string;
  entityId: string;
  path: string;
  before?: unknown;
  after?: unknown;
}

export interface AutomationCommandDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  access: AutomationAccess;
  idempotent: boolean;
  supportsDryRun: boolean;
  permission: string;
  handler: string;
  applicationCommands?: string[];
  deprecatedAliasFor?: string;
}

export interface AutomationRequest {
  command: string;
  input?: unknown;
  expectedRevision?: number;
  idempotencyKey?: string;
  dryRun?: boolean;
  correlationId: string;
  source: AutomationSource;
  permissions: string[];
  actor?: AutomationActorIdentity;
}

export interface AutomationDiagnostic {
  code: string;
  message: string;
  path?: string;
}

export interface AutomationAuditEvent {
  id: string;
  correlationId: string;
  command: string;
  source: AutomationSource;
  actor: AutomationActorIdentity;
  access: AutomationAccess;
  status: AutomationOutcomeStatus;
  revisionBefore: number;
  revisionAfter: number;
  dryRun: boolean;
  timestamp: string;
  idempotencyKey?: string;
  diagnosticCodes: string[];
}

export interface AutomationOutcome<T = unknown> {
  status: AutomationOutcomeStatus;
  command: string;
  correlationId: string;
  revisionBefore: number;
  revisionAfter: number;
  dryRun: boolean;
  output?: T;
  changes: AutomationSemanticChange[];
  diagnostics: AutomationDiagnostic[];
  audit: AutomationAuditEvent;
}

export interface AutomationBatchOperation {
  command: string;
  input?: unknown;
}
