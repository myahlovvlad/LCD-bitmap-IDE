/**
 * UX Semantic Contract — typed, versioned project-level metadata describing operator-facing
 * intent (screen/state/transition/control roles and intents, terminology, user goals, policies,
 * scripted UX scenarios). This is additive metadata: it never changes FSM/screen/control-panel
 * executable structure, only annotates it. See docs/UX_SEMANTIC_VALIDATION.md for the rule
 * catalogue that consumes this contract.
 */

export type UxUserRole = string;

export type ScreenRole =
  | 'navigation'
  | 'operation'
  | 'progress'
  | 'confirmation'
  | 'result'
  | 'warning'
  | 'error'
  | 'settings'
  | 'information'
  | 'authentication'
  | 'maintenance'
  | 'unknown';

export const SCREEN_ROLES: readonly ScreenRole[] = [
  'navigation', 'operation', 'progress', 'confirmation', 'result',
  'warning', 'error', 'settings', 'information', 'authentication', 'maintenance', 'unknown'
];

export type UxRiskLevel = 'none' | 'informational' | 'caution' | 'destructive' | 'critical';

export type UxFindingSeverity = 'error' | 'warning' | 'info' | 'suggestion' | 'needs_human_review';

export type UxControlActionKind =
  | 'navigate' | 'submit' | 'cancel' | 'confirm' | 'back' | 'retry'
  | 'save' | 'delete' | 'start' | 'stop' | 'help' | 'custom';

export interface ScreenUxMetadata {
  role?: ScreenRole;
  userGoalIds?: string[];
  purpose?: string;
  operatorHint?: string;
  primaryActionIntent?: string;
  expectedActionIntents?: string[];
  prohibitedActionIntents?: string[];
  requiredInformation?: string[];
  requiredRecoveryActionIntents?: string[];
  riskLevel?: UxRiskLevel;
}

export interface StateUxMetadata {
  role?: ScreenRole;
  purpose?: string;
  userGoalIds?: string[];
  screenId?: string;
  recoveryStateId?: string;
  isTerminal?: boolean;
  /** Marks a state that is only ever reached through a runtime overlay mechanism (e.g. a
   *  hardware-presence notification driven by a tag, not by an FSM transition) rather than
   *  normal operator navigation. Reachability/orphan/recovery/loop rules treat it as exempt:
   *  being unreachable from the initial state via ordinary transitions is expected for an
   *  overlay state, not a defect. */
  isOverlay?: boolean;
}

export interface TransitionUxMetadata {
  intent?: string;
  userVisibleTriggerControlId?: string;
  requiresConfirmation?: boolean;
  confirmationStateId?: string;
  riskLevel?: UxRiskLevel;
  rationale?: string;
  successMessageKey?: string;
  failureRecoveryIntent?: string;
}

export interface ControlUxMetadata {
  intent?: string;
  labelKey?: string;
  actionKind?: UxControlActionKind;
  riskLevel?: UxRiskLevel;
  requiresConfirmation?: boolean;
  helpText?: string;
}

export interface UxTerminologyEntry {
  intent: string;
  preferredLabels: Record<string, string>;
  forbiddenLabels?: Record<string, string[]>;
  description?: string;
}

export interface UxUserGoal {
  id: string;
  title: string;
  description?: string;
  actorRoles?: string[];
  startStateIds?: string[];
  successStateIds?: string[];
  failureStateIds?: string[];
  requiredIntents?: string[];
  prohibitedIntents?: string[];
  criticality?: UxRiskLevel;
}

export type UxScenarioStep =
  | { type: 'event'; eventId: string; expectedStateId?: string }
  | { type: 'button'; buttonId: string; expectedStateId?: string }
  | { type: 'tag'; tagId: string; value: string | number | boolean | null };

export interface UxScenarioDefinition {
  id: string;
  title: string;
  goalId?: string;
  initialStateId?: string;
  steps: UxScenarioStep[];
  expectedFinalStateId?: string;
  expectNoBlockedSteps?: boolean;
  requiredVisibleMessages?: string[];
  severityOnFailure?: 'error' | 'warning';
}

export interface UxPolicySet {
  requireErrorRecoveryPath: boolean;
  requireBackOrExitFromNonTerminalState: boolean;
  requireConfirmationForDestructiveActions: boolean;
  requireVisibleTriggerForUserInitiatedTransitions: boolean;
  requireIntentForInteractiveControls: boolean;
  requireTerminologyConsistency: boolean;
  requireScenarioForCriticalGoals: boolean;
  requireProgressFeedbackForLongRunningOperations: boolean;
  treatUnclassifiedInteractiveControlsAsWarning: boolean;
  defaultLocale: 'en' | 'ru' | 'zh';
  /** ux.unintended-navigation-loop only reports a strongly-connected component at or below this
   *  size. Above it, a cycle is presumed to be the ordinary "any mode can return to a navigation
   *  hub and back" shape of a multi-mode device rather than a meaningfully surprising loop —
   *  without a cap, one hub-centric project can produce a single finding spanning most of the
   *  graph, which is technically true but not actionable. */
  unintendedNavigationLoopMaxSize: number;
}

export const DEFAULT_UX_POLICIES: UxPolicySet = {
  requireErrorRecoveryPath: true,
  requireBackOrExitFromNonTerminalState: true,
  requireConfirmationForDestructiveActions: true,
  requireVisibleTriggerForUserInitiatedTransitions: true,
  requireIntentForInteractiveControls: true,
  requireTerminologyConsistency: true,
  requireScenarioForCriticalGoals: true,
  requireProgressFeedbackForLongRunningOperations: true,
  treatUnclassifiedInteractiveControlsAsWarning: true,
  defaultLocale: 'ru',
  unintendedNavigationLoopMaxSize: 20
};

/** Normalized, always-present shape of the UX contract as stored on the project. */
export interface ProjectUxContract {
  version: 1;
  projectPurpose?: string;
  intendedUsers?: UxUserRole[];
  terminology: UxTerminologyEntry[];
  userGoals: UxUserGoal[];
  policies: UxPolicySet;
  screens: Record<string, ScreenUxMetadata>;
  states: Record<string, StateUxMetadata>;
  transitions: Record<string, TransitionUxMetadata>;
  controls: Record<string, ControlUxMetadata>;
  scenarios: UxScenarioDefinition[];
}

export const EMPTY_UX_CONTRACT: ProjectUxContract = {
  version: 1,
  terminology: [],
  userGoals: [],
  policies: DEFAULT_UX_POLICIES,
  screens: {},
  states: {},
  transitions: {},
  controls: {},
  scenarios: []
};

export interface UxContractIdRefs {
  screenIds: ReadonlySet<string>;
  stateIds: ReadonlySet<string>;
  transitionIds: ReadonlySet<string>;
  controlIds: ReadonlySet<string>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizePolicies(raw: unknown): UxPolicySet {
  if (!isPlainObject(raw)) return { ...DEFAULT_UX_POLICIES };
  const merged: UxPolicySet = { ...DEFAULT_UX_POLICIES };
  for (const key of Object.keys(DEFAULT_UX_POLICIES) as (keyof UxPolicySet)[]) {
    const value = raw[key];
    if (key === 'defaultLocale') {
      if (value === 'en' || value === 'ru' || value === 'zh') merged.defaultLocale = value;
      continue;
    }
    if (key === 'unintendedNavigationLoopMaxSize') {
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) merged.unintendedNavigationLoopMaxSize = value;
      continue;
    }
    if (typeof value === 'boolean') (merged[key] as boolean) = value;
  }
  return merged;
}

function normalizeStringArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : [];
}

function normalizeTerminology(raw: unknown): UxTerminologyEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: UxTerminologyEntry[] = [];
  for (const entry of raw) {
    if (!isPlainObject(entry) || typeof entry.intent !== 'string' || !entry.intent.trim()) continue;
    const preferredLabels: Record<string, string> = isPlainObject(entry.preferredLabels)
      ? Object.fromEntries(Object.entries(entry.preferredLabels).filter((pair): pair is [string, string] => typeof pair[1] === 'string'))
      : {};
    const forbiddenLabelsRaw = entry.forbiddenLabels;
    const forbiddenLabels = isPlainObject(forbiddenLabelsRaw)
      ? Object.fromEntries(Object.entries(forbiddenLabelsRaw).map(([locale, list]) => [locale, normalizeStringArray(list)]))
      : undefined;
    out.push({
      intent: entry.intent,
      preferredLabels,
      forbiddenLabels,
      description: typeof entry.description === 'string' ? entry.description : undefined
    });
  }
  return out;
}

function normalizeUserGoals(raw: unknown, refs: UxContractIdRefs): UxUserGoal[] {
  if (!Array.isArray(raw)) return [];
  const out: UxUserGoal[] = [];
  for (const entry of raw) {
    if (!isPlainObject(entry) || typeof entry.id !== 'string' || !entry.id.trim() || typeof entry.title !== 'string') continue;
    out.push({
      id: entry.id,
      title: entry.title,
      description: typeof entry.description === 'string' ? entry.description : undefined,
      actorRoles: normalizeStringArray(entry.actorRoles),
      startStateIds: normalizeStringArray(entry.startStateIds).filter((id) => refs.stateIds.has(id)),
      successStateIds: normalizeStringArray(entry.successStateIds).filter((id) => refs.stateIds.has(id)),
      failureStateIds: normalizeStringArray(entry.failureStateIds).filter((id) => refs.stateIds.has(id)),
      requiredIntents: normalizeStringArray(entry.requiredIntents),
      prohibitedIntents: normalizeStringArray(entry.prohibitedIntents),
      criticality: isUxRiskLevel(entry.criticality) ? entry.criticality : undefined
    });
  }
  return out;
}

function isUxRiskLevel(value: unknown): value is UxRiskLevel {
  return value === 'none' || value === 'informational' || value === 'caution' || value === 'destructive' || value === 'critical';
}

function normalizeScenarioStep(raw: unknown): UxScenarioStep | null {
  if (!isPlainObject(raw)) return null;
  if (raw.type === 'event' && typeof raw.eventId === 'string') {
    return { type: 'event', eventId: raw.eventId, expectedStateId: typeof raw.expectedStateId === 'string' ? raw.expectedStateId : undefined };
  }
  if (raw.type === 'button' && typeof raw.buttonId === 'string') {
    return { type: 'button', buttonId: raw.buttonId, expectedStateId: typeof raw.expectedStateId === 'string' ? raw.expectedStateId : undefined };
  }
  if (raw.type === 'tag' && typeof raw.tagId === 'string') {
    const value = raw.value;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
      return { type: 'tag', tagId: raw.tagId, value };
    }
  }
  return null;
}

function normalizeScenarios(raw: unknown): UxScenarioDefinition[] {
  if (!Array.isArray(raw)) return [];
  const out: UxScenarioDefinition[] = [];
  for (const entry of raw) {
    if (!isPlainObject(entry) || typeof entry.id !== 'string' || !entry.id.trim() || typeof entry.title !== 'string') continue;
    const steps = Array.isArray(entry.steps) ? entry.steps.map(normalizeScenarioStep).filter((s): s is UxScenarioStep => s !== null) : [];
    if (steps.length === 0) continue;
    out.push({
      id: entry.id,
      title: entry.title,
      goalId: typeof entry.goalId === 'string' ? entry.goalId : undefined,
      initialStateId: typeof entry.initialStateId === 'string' ? entry.initialStateId : undefined,
      steps,
      expectedFinalStateId: typeof entry.expectedFinalStateId === 'string' ? entry.expectedFinalStateId : undefined,
      expectNoBlockedSteps: typeof entry.expectNoBlockedSteps === 'boolean' ? entry.expectNoBlockedSteps : undefined,
      requiredVisibleMessages: entry.requiredVisibleMessages ? normalizeStringArray(entry.requiredVisibleMessages) : undefined,
      severityOnFailure: entry.severityOnFailure === 'error' || entry.severityOnFailure === 'warning' ? entry.severityOnFailure : undefined
    });
  }
  return out;
}

function normalizeScreenMetadata(raw: unknown): ScreenUxMetadata | null {
  if (!isPlainObject(raw)) return null;
  return {
    role: SCREEN_ROLES.includes(raw.role as ScreenRole) ? (raw.role as ScreenRole) : undefined,
    userGoalIds: raw.userGoalIds ? normalizeStringArray(raw.userGoalIds) : undefined,
    purpose: typeof raw.purpose === 'string' ? raw.purpose : undefined,
    operatorHint: typeof raw.operatorHint === 'string' ? raw.operatorHint : undefined,
    primaryActionIntent: typeof raw.primaryActionIntent === 'string' ? raw.primaryActionIntent : undefined,
    expectedActionIntents: raw.expectedActionIntents ? normalizeStringArray(raw.expectedActionIntents) : undefined,
    prohibitedActionIntents: raw.prohibitedActionIntents ? normalizeStringArray(raw.prohibitedActionIntents) : undefined,
    requiredInformation: raw.requiredInformation ? normalizeStringArray(raw.requiredInformation) : undefined,
    requiredRecoveryActionIntents: raw.requiredRecoveryActionIntents ? normalizeStringArray(raw.requiredRecoveryActionIntents) : undefined,
    riskLevel: isUxRiskLevel(raw.riskLevel) ? raw.riskLevel : undefined
  };
}

function normalizeStateMetadata(raw: unknown, refs: UxContractIdRefs): StateUxMetadata | null {
  if (!isPlainObject(raw)) return null;
  const screenId = typeof raw.screenId === 'string' && refs.screenIds.has(raw.screenId) ? raw.screenId : undefined;
  const recoveryStateId = typeof raw.recoveryStateId === 'string' && refs.stateIds.has(raw.recoveryStateId) ? raw.recoveryStateId : undefined;
  return {
    role: SCREEN_ROLES.includes(raw.role as ScreenRole) ? (raw.role as ScreenRole) : undefined,
    purpose: typeof raw.purpose === 'string' ? raw.purpose : undefined,
    userGoalIds: raw.userGoalIds ? normalizeStringArray(raw.userGoalIds) : undefined,
    screenId,
    recoveryStateId,
    isTerminal: typeof raw.isTerminal === 'boolean' ? raw.isTerminal : undefined,
    isOverlay: typeof raw.isOverlay === 'boolean' ? raw.isOverlay : undefined
  };
}

function normalizeTransitionMetadata(raw: unknown, refs: UxContractIdRefs): TransitionUxMetadata | null {
  if (!isPlainObject(raw)) return null;
  const triggerControlId = typeof raw.userVisibleTriggerControlId === 'string' && refs.controlIds.has(raw.userVisibleTriggerControlId)
    ? raw.userVisibleTriggerControlId
    : undefined;
  const confirmationStateId = typeof raw.confirmationStateId === 'string' && refs.stateIds.has(raw.confirmationStateId)
    ? raw.confirmationStateId
    : undefined;
  return {
    intent: typeof raw.intent === 'string' ? raw.intent : undefined,
    userVisibleTriggerControlId: triggerControlId,
    requiresConfirmation: typeof raw.requiresConfirmation === 'boolean' ? raw.requiresConfirmation : undefined,
    confirmationStateId,
    riskLevel: isUxRiskLevel(raw.riskLevel) ? raw.riskLevel : undefined,
    rationale: typeof raw.rationale === 'string' ? raw.rationale : undefined,
    successMessageKey: typeof raw.successMessageKey === 'string' ? raw.successMessageKey : undefined,
    failureRecoveryIntent: typeof raw.failureRecoveryIntent === 'string' ? raw.failureRecoveryIntent : undefined
  };
}

const CONTROL_ACTION_KINDS: readonly UxControlActionKind[] = [
  'navigate', 'submit', 'cancel', 'confirm', 'back', 'retry', 'save', 'delete', 'start', 'stop', 'help', 'custom'
];

function normalizeControlMetadata(raw: unknown): ControlUxMetadata | null {
  if (!isPlainObject(raw)) return null;
  return {
    intent: typeof raw.intent === 'string' ? raw.intent : undefined,
    labelKey: typeof raw.labelKey === 'string' ? raw.labelKey : undefined,
    actionKind: CONTROL_ACTION_KINDS.includes(raw.actionKind as UxControlActionKind) ? (raw.actionKind as UxControlActionKind) : undefined,
    riskLevel: isUxRiskLevel(raw.riskLevel) ? raw.riskLevel : undefined,
    requiresConfirmation: typeof raw.requiresConfirmation === 'boolean' ? raw.requiresConfirmation : undefined,
    helpText: typeof raw.helpText === 'string' ? raw.helpText : undefined
  };
}

function normalizeIdMap<T>(
  raw: unknown,
  validIds: ReadonlySet<string>,
  normalizeEntry: (entry: unknown) => T | null
): Record<string, T> {
  if (!isPlainObject(raw)) return {};
  const out: Record<string, T> = {};
  for (const [id, entry] of Object.entries(raw)) {
    if (!validIds.has(id)) continue;
    const normalized = normalizeEntry(entry);
    if (normalized) out[id] = normalized;
  }
  return out;
}

/**
 * Normalizes a raw/legacy UX contract against the current project's live IDs, dropping any
 * reference to a screen/state/transition/control that no longer exists (mirrors
 * normalizeHardwareNotificationConfig's dangling-reference cleanup). Always returns a
 * fully-populated contract so downstream code never needs to guard against missing maps.
 */
export function normalizeUxContract(raw: unknown, refs: UxContractIdRefs): ProjectUxContract {
  if (!isPlainObject(raw)) {
    return { ...EMPTY_UX_CONTRACT, policies: { ...DEFAULT_UX_POLICIES } };
  }
  return {
    version: 1,
    projectPurpose: typeof raw.projectPurpose === 'string' ? raw.projectPurpose : undefined,
    intendedUsers: raw.intendedUsers ? normalizeStringArray(raw.intendedUsers) : undefined,
    terminology: normalizeTerminology(raw.terminology),
    userGoals: normalizeUserGoals(raw.userGoals, refs),
    policies: normalizePolicies(raw.policies),
    screens: normalizeIdMap(raw.screens, refs.screenIds, normalizeScreenMetadata),
    states: normalizeIdMap(raw.states, refs.stateIds, (entry) => normalizeStateMetadata(entry, refs)),
    transitions: normalizeIdMap(raw.transitions, refs.transitionIds, (entry) => normalizeTransitionMetadata(entry, refs)),
    controls: normalizeIdMap(raw.controls, refs.controlIds, normalizeControlMetadata),
    scenarios: normalizeScenarios(raw.scenarios)
  };
}

export function buildUxContractIdRefs(project: {
  screens: Record<string, { id: string }>;
  fsm: { states: Record<string, { id: string }>; transitions: Record<string, { id: string }> };
  controlPanel: { elements: Record<string, { id: string }> };
}): UxContractIdRefs {
  return {
    screenIds: new Set(Object.keys(project.screens)),
    stateIds: new Set(Object.keys(project.fsm.states)),
    transitionIds: new Set(Object.keys(project.fsm.transitions)),
    controlIds: new Set(Object.keys(project.controlPanel.elements))
  };
}
