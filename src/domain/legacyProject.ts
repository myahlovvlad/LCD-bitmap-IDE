import type { CanvasData, DisplayConfig, GraphPosition } from './canvas';
import type { SupportedModelId } from './localization';

export interface LegacyFsmState {
  id: string;
  runtimeId: string | null;
  legacyIds: string[];
  title: string;
  subsystem: string;
  stateType: string;
  origin: string;
  sourceLcd: string[];
  initial: boolean;
  final: boolean;
}

export interface LegacyFsmTransition {
  id: string;
  from: string;
  to: string;
  trigger: string;
  kind: string;
  condition: string | null;
  source: string | null;
  cliCommands: string[];
}

export interface HardwareCommand {
  command: string;
  expectedResponse?: string;
  latencyMs?: number;
  jitterPercent?: number;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  entityType: 'project' | 'fsm-state' | 'fsm-transition' | 'canvas-object';
  entityId: string;
  operation: 'create' | 'update' | 'delete' | 'import';
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
}

export interface SavedMeasurement {
  id: string;
  stateId: string;
  label: string;
  value: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface LegacyProject {
  id: string;
  name: string;
  version: string;
  modelId: SupportedModelId;
  firmwareVersion: string | null;
  author: string | null;
  lastModified: string;
  display: DisplayConfig;
  states: Record<string, LegacyFsmState>;
  transitions: Record<string, LegacyFsmTransition>;
  canvasByStateId: Record<string, CanvasData>;
  graphLayout: Record<string, GraphPosition>;
  auditTrail: AuditEntry[];
}

export interface ImportedProjectModel {
  project: LegacyProject;
  stateOrder: string[];
  transitionOrder: string[];
}
