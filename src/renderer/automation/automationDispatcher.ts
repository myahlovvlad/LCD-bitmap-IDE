import type {
  AutomationAuditEvent,
  AutomationBatchOperation,
  AutomationCommandDefinition,
  AutomationDiagnostic,
  AutomationOutcome,
  AutomationOutcomeStatus,
  AutomationRequest
} from '../../shared/automation';
import {
  getAutomationCapabilities,
  getAutomationDefinition,
  getMcpToolDefinitions,
  parseAutomationInput,
  parseAutomationOutput,
  parseAutomationRequest
} from '../../shared/automation';
import type { CommandMetadata, ProjectChangeSet, ProjectCommand, ProjectCommandResult } from '../../application';
import { applyScreenDslPreview, createScreenHtmlPreview, exportSessionScreenInterchangeScreen, undoProjectSession } from '../../application';
import type { AlarmDefinition, ControlPanelElement, FsmEvent, FsmState, FsmTransition } from '../../domain/project';
import type { HmiTag } from '../../domain/tag';
import type { BackendProcedure } from '../../domain/procedure';
import { FontRenderer, normalizeDisplayProfile, type DisplayProfile } from '../../domain';
import {
  canonicalRasterToRgbaBytes,
  compareFramebuffers,
  analyzeScreenLayout,
  createCanonicalRaster,
  createSoftwareEvidenceBundle,
  decodeDisplayBytes,
  encodeRasterPng,
  renderProjectScreen,
  rgba
} from '../../compiler';
import { sha256Hex } from '../../compiler/artifacts/sha256';
import { screenInterchangeToHtml } from '../../screen-html';
import { validateProject } from '../../services/projectValidationService';
import { computeElkLayout } from '../core/elkLayout';
import { beginOperation } from '../notifications/notificationStore';
import {
  executeProjectStoreChangeSet,
  executeProjectStoreCommand,
  replaceProjectStoreSession,
  useProjectStore
} from '../store/projectStore';
import { compileAssetsForAutomation } from './compileAssets';
import { fireAutomationRuntimeEvent, getAutomationRuntimeState, setAutomationRuntimeTag } from './runtimeAutomation';
import type { TagValue } from '../../services/runtime/TagContext';

const MAX_AUDIT_EVENTS = 500;
const MAX_IDEMPOTENCY_ENTRIES = 256;
const auditLog: AutomationAuditEvent[] = [];
const idempotencyCache = new Map<string, AutomationOutcome>();

export async function executeAutomationRequest(requestValue: unknown): Promise<AutomationOutcome> {
  const envelope = parseAutomationRequest(requestValue);
  if (!envelope.success) {
    const revision = useProjectStore.getState().revision;
    const request = fallbackRequest(requestValue);
    return finish(request, fallbackDefinition(request.command), revision, 'failure', undefined, [], envelope.error.issues.map((issue) => ({
      code: 'automation.invalid-request',
      message: issue.message,
      path: issue.path.join('.')
    })));
  }
  let request = envelope.data as AutomationRequest;
  request = request.command === 'preview_changes' ? { ...request, dryRun: true } : request;
  const definition = getAutomationDefinition(request.command);
  const revisionBefore = useProjectStore.getState().revision;
  if (!definition) return finish(request, fallbackDefinition(request.command), revisionBefore, 'failure', undefined, [], [{ code: 'automation.unknown-command', message: `Unknown automation command: ${request.command}` }]);

  const parsed = parseAutomationInput(request.command, request.input ?? {});
  if (!parsed?.success) {
    const diagnostics = parsed?.error.issues.map((issue) => ({
      code: 'automation.invalid-input',
      message: issue.message,
      path: issue.path.join('.')
    })) ?? [{ code: 'automation.invalid-input', message: 'Invalid automation input.' }];
    return finish(request, definition, revisionBefore, 'failure', undefined, [], diagnostics);
  }

  if (!request.permissions.includes(definition.permission)) {
    return finish(request, definition, revisionBefore, 'blocked', undefined, [], [{
      code: 'automation.permission-denied',
      message: `Permission "${definition.permission}" is required.`
    }]);
  }
  const cacheKey = request.idempotencyKey
    ? `${useProjectStore.getState().project?.meta.id ?? 'no-project'}:${request.command}:${request.idempotencyKey}`
    : null;
  if (cacheKey && idempotencyCache.has(cacheKey)) {
    const cached = idempotencyCache.get(cacheKey)!;
    return finish(request, definition, revisionBefore, 'noop', {
      replayed: true,
      originalCorrelationId: cached.correlationId,
      originalStatus: cached.status,
      originalOutput: cached.output
    }, [], [{
      code: 'automation.idempotent-replay',
      message: `The idempotency key was already applied by ${cached.correlationId}; no command was executed.`
    }]);
  }
  if (definition.access !== 'read' && request.expectedRevision === undefined) {
    return finish(request, definition, revisionBefore, 'conflict', undefined, [], [{
      code: 'automation.expected-revision-required',
      message: 'expectedRevision is required for write and destructive operations.'
    }]);
  }
  if (request.expectedRevision !== undefined && request.expectedRevision !== revisionBefore) {
    return finish(request, definition, revisionBefore, 'conflict', undefined, [], [{
      code: 'automation.revision-conflict',
      message: `Expected revision ${request.expectedRevision}, current revision is ${revisionBefore}.`
    }]);
  }
  if (request.dryRun && !definition.supportsDryRun) {
    return finish(request, definition, revisionBefore, 'blocked', undefined, [], [{
      code: 'automation.dry-run-unsupported',
      message: `Command "${request.command}" does not support dry-run.`
    }]);
  }

  const operation = definition.access === 'read' ? null : beginOperation(
    request.dryRun ? `Preview: ${request.command}` : request.command,
    {
    message: `Correlation ${request.correlationId}`,
    source: `automation:${request.source}`,
    dedupeKey: request.idempotencyKey ? `automation:${cacheKey}` : undefined
    }
  );

  try {
    const execution = await dispatchValidatedRequest(request, definition, parsed.data as Record<string, unknown>);
    const validatedOutput = execution.output === undefined ? null : parseAutomationOutput(request.command, execution.output);
    if (validatedOutput && !validatedOutput.success) {
      const diagnostics = validatedOutput.error.issues.map((issue) => ({
        code: 'automation.invalid-output',
        message: issue.message,
        path: issue.path.join('.')
      }));
      operation?.fail('Invalid automation output', diagnostics[0]?.message);
      return finish(request, definition, revisionBefore, 'failure', undefined, execution.result?.changes ?? [], diagnostics);
    }
    const outcome = finish(
      request,
      definition,
      revisionBefore,
      execution.status,
      execution.output,
      execution.result?.changes ?? [],
      execution.diagnostics
    );
    if (outcome.status === 'success' || outcome.status === 'noop') {
      operation?.succeed(`${request.command}: ${outcome.status}`, `Revision ${outcome.revisionAfter}`);
    } else {
      operation?.fail(`${request.command}: ${outcome.status}`, outcome.diagnostics[0]?.message);
    }
    if (cacheKey) rememberIdempotentOutcome(cacheKey, outcome);
    return outcome;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    operation?.fail(message);
    return finish(request, definition, revisionBefore, 'failure', undefined, [], [{ code: 'automation.execution-failed', message }]);
  }
}

interface DispatchResult {
  status: AutomationOutcomeStatus;
  output?: unknown;
  result?: ProjectCommandResult;
  diagnostics: AutomationDiagnostic[];
}

async function dispatchValidatedRequest(
  request: AutomationRequest,
  definition: AutomationCommandDefinition,
  input: Record<string, unknown>
): Promise<DispatchResult> {
  const store = useProjectStore.getState();
  const project = store.project;

  switch (definition.handler) {
    case 'get_capabilities':
      return successful({ protocolVersion: '1.0', commands: getAutomationCapabilities(), mcpTools: getMcpToolDefinitions() });
    case 'get_project_revision':
      return successful({ projectId: project?.meta.id ?? null, revision: store.revision });
    case 'get_project_summary':
      return successful(project ? {
        projectId: project.meta.id,
        name: project.meta.name,
        schemaVersion: project.meta.schemaVersion,
        revision: store.revision,
        stateCount: project.fsm.stateOrder.length,
        transitionCount: project.fsm.transitionOrder.length,
        screenCount: project.screenOrder.length,
        tagCount: Object.keys(project.tags ?? {}).length,
        procedureCount: Object.keys(project.procedures ?? {}).length,
        alarmCount: Object.keys(project.alarms ?? {}).length
      } : { projectId: null, revision: store.revision });
    case 'get_authoring_language': return successful({ language: project?.authoringLanguage ?? 'en' });
    case 'get_display_profile': return project ? successful({ profile: project.display }) : blocked('automation.no-project', 'No project loaded');
    case 'list_fsm_states': return successful({ states: ordered(project?.fsm.stateOrder, project?.fsm.states) });
    case 'list_fsm_transitions': return successful({ transitions: ordered(project?.fsm.transitionOrder, project?.fsm.transitions) });
    case 'list_fsm_events': return successful({ events: ordered(project?.fsm.eventOrder, project?.fsm.events) });
    case 'list_screens': return successful({ screens: ordered(project?.screenOrder, project?.screens), screenOrder: project?.screenOrder ?? [] });
    case 'get_screen': {
      const screenId = input.screenId as string;
      const screen = project?.screens[screenId];
      return screen ? successful({ screen }) : failed('automation.screen-not-found', `Screen not found: ${screenId}`);
    }
    case 'list_control_panel_elements': return successful({ elements: ordered(project?.controlPanel.elementOrder, project?.controlPanel.elements) });
    case 'validate_project': return project ? successful({ issues: validateProject(project) }) : blocked('automation.no-project', 'No project loaded');
    case 'get_validation_report': return successful({ validation: project?.validation ?? { issues: [], validatedAt: null } });
    case 'list_tags': return successful({ tags: Object.values(project?.tags ?? {}) });
    case 'list_procedures': return successful({ procedures: Object.values(project?.procedures ?? {}) });
    case 'list_alarms': return successful({ alarms: Object.values(project?.alarms ?? {}) });
    case 'get_runtime_state': return successful({ runtimeState: getAutomationRuntimeState() });
    case 'list_export_formats': return successful({ formats: ['c-vertical-lsb', 'c-horizontal-msb', 'c-horizontal-lsb', 'xbm', 'arduino-progmem', 'rust-embedded', 'esp-idf', 'binary'] });
    case 'get_automation_audit': return successful({ events: [...auditLog] });
    case 'render_screen': {
      if (!project) return blocked('automation.no-project', 'No project loaded');
      const rendered = renderProjectScreen({
        project,
        language: project.authoringLanguage ?? store.language,
        screenId: input.screenId as string | undefined,
        fontGlyphs: store.fontGlyphs
      });
      const layout = analyzeScreenLayout(
        rendered.screen,
        project.authoringLanguage ?? store.language,
        new FontRenderer(store.fontGlyphs)
      );
      const rgbaBytes = canonicalRasterToRgbaBytes(rendered.screen.canonicalRaster);
      return successful({
        screenId: rendered.screen.id,
        width: rendered.screen.width,
        height: rendered.screen.height,
        previewPngBase64: bytesToBase64(encodeRasterPng(rendered.screen.canonicalRaster)),
        canonicalRaster: {
          pixelFormat: 'argb8888',
          sha256: sha256Hex(rgbaBytes),
          byteLength: rgbaBytes.length
        },
        boundingBoxes: layout.boundingBoxes,
        issues: layout.issues,
        overlayPngBase64: bytesToBase64(encodeRasterPng(layout.overlay))
      });
    }
    case 'export_screen_html': {
      if (!project || !store.session) return blocked('automation.no-project', 'No project loaded');
      const screenId = input.screenId as string;
      if (!project.screens[screenId]) return failed('automation.screen-not-found', `Screen not found: ${screenId}`);
      const exported = exportSessionScreenInterchangeScreen(store.session, screenId);
      const rendered = renderProjectScreen({ project, language: project.authoringLanguage ?? store.language, screenId, fontGlyphs: store.fontGlyphs });
      const layout = analyzeScreenLayout(rendered.screen, project.authoringLanguage ?? store.language, new FontRenderer(store.fontGlyphs));
      return successful({ screenId, width: rendered.screen.width, height: rendered.screen.height, html: screenInterchangeToHtml(exported.package, screenId), issues: layout.issues });
    }
    case 'analyze_128x64_screens': {
      if (!project) return blocked('automation.no-project', 'No project loaded');
      const requestedScreenId = input.screenId as string | undefined;
      const screenIds = requestedScreenId ? [requestedScreenId] : project.screenOrder;
      if (requestedScreenId && !project.screens[requestedScreenId]) return failed('automation.screen-not-found', `Screen not found: ${requestedScreenId}`);
      const screens = screenIds.map((screenId) => {
        const rendered = renderProjectScreen({ project, language: project.authoringLanguage ?? store.language, screenId, fontGlyphs: store.fontGlyphs });
        const layout = analyzeScreenLayout(rendered.screen, project.authoringLanguage ?? store.language, new FontRenderer(store.fontGlyphs));
        return { screenId, width: rendered.screen.width, height: rendered.screen.height, dimensionsMatch: rendered.screen.width === 128 && rendered.screen.height === 64, objectCount: rendered.screen.objects.length, issues: layout.issues };
      });
      const compliantScreenCount = screens.filter((screen) => screen.dimensionsMatch && !screen.issues.some((issue) => issue.severity === 'error')).length;
      return successful({ target: { width: 128, height: 64 }, screenCount: screens.length, compliantScreenCount, nonCompliantScreenCount: screens.length - compliantScreenCount, screens });
    }
    case 'preview_screen_html_import': {
      if (!store.session) return blocked('automation.no-project', 'No project loaded');
      const preview = createScreenHtmlPreview(store.session, { html: input.html as string, importMode: input.importMode as 'create' | 'update' | 'clone', expectedRevision: request.expectedRevision!, targetScreenId: input.targetScreenId as string | undefined, actor: request.actor });
      if (!preview.success) return { status: 'failure', diagnostics: preview.diagnostics.map((item) => ({ code: item.code, message: item.message, path: item.path })) };
      return successful({ canonicalHtml: preview.canonicalHtml, diagnostics: preview.diagnostics, semanticDiff: preview.screenDslPreview?.semanticDiff, applyAllowed: preview.screenDslPreview?.applyAllowed ?? false });
    }
    case 'apply_screen_html_import': {
      if (!store.session) return blocked('automation.no-project', 'No project loaded');
      const preview = createScreenHtmlPreview(store.session, { html: input.html as string, importMode: input.importMode as 'create' | 'update' | 'clone', expectedRevision: request.expectedRevision!, targetScreenId: input.targetScreenId as string | undefined, actor: request.actor });
      if (!preview.success || !preview.screenDslPreview || !preview.screenDslSource) return { status: 'failure', diagnostics: preview.diagnostics.map((item) => ({ code: item.code, message: item.message, path: item.path })) };
      const applied = applyScreenDslPreview(store.session, { preview: preview.screenDslPreview, sourceText: preview.screenDslSource, confirmDestructive: Boolean(input.confirmDestructive) });
      if (!applied.applied || !applied.result) return { status: 'failure', diagnostics: applied.diagnostics.map((item) => ({ code: item.code, message: item.message, path: item.path })) };
      replaceProjectStoreSession(applied.result.session);
      return { status: 'success', result: applied.result, output: { applied: true, transaction: applied.transaction }, diagnostics: [] };
    }
    case 'preview_export': {
      if (!project) return blocked('automation.no-project', 'No project loaded');
      const evidence = createSoftwareEvidenceBundle({
        project,
        language: project.authoringLanguage ?? store.language,
        screenId: input.screenId as string | undefined,
        fontGlyphs: store.fontGlyphs
      });
      return successful({
        screenId: evidence.screenId,
        profileFingerprint: evidence.profileFingerprint,
        projectFingerprint: evidence.projectFingerprint,
        comparison: evidence.comparison,
        artifacts: evidence.artifacts.map(({ path, mediaType, byteLength, sha256 }) => ({ path, mediaType, byteLength, sha256 }))
      });
    }
    case 'create_evidence_bundle': {
      if (!project) return blocked('automation.no-project', 'No project loaded');
      const evidence = createSoftwareEvidenceBundle({
        project,
        language: project.authoringLanguage ?? store.language,
        screenId: input.screenId as string | undefined,
        fontGlyphs: store.fontGlyphs
      });
      return successful({
        screenId: evidence.screenId,
        filename: `${project.meta.id}-${evidence.screenId}-evidence.zip`,
        encoding: 'base64',
        content: bytesToBase64(evidence.zip),
        comparison: evidence.comparison,
        artifacts: evidence.artifacts.map(({ path, mediaType, byteLength, sha256 }) => ({ path, mediaType, byteLength, sha256 }))
      });
    }
    case 'decode_artifact': {
      if (!project) return blocked('automation.no-project', 'No project loaded');
      const profile = normalizeDisplayProfile(input.profile ?? project.display, project.display);
      const decoded = decodeDisplayBytes(base64ToBytes(input.content as string), profile);
      const rgbaBytes = canonicalRasterToRgbaBytes(decoded);
      return successful({ width: decoded.width, height: decoded.height, profileFingerprint: profile.fingerprint, rgbaBase64: bytesToBase64(rgbaBytes), sha256: sha256Hex(rgbaBytes) });
    }
    case 'compare_framebuffers': {
      const width = input.width as number;
      const height = input.height as number;
      const expected = rgbaBytesToRaster(base64ToBytes(input.expectedRgbaBase64 as string), width, height);
      const decoded = rgbaBytesToRaster(base64ToBytes(input.decodedRgbaBase64 as string), width, height);
      return successful({ comparison: compareFramebuffers(expected, decoded) });
    }
    case 'compile_assets': return successful(compileAssetsForAutomation(input));
    case 'fire_runtime_event':
      await fireAutomationRuntimeEvent(input.eventId as string);
      return successful({ eventId: input.eventId });
    case 'set_runtime_tag':
      await setAutomationRuntimeTag(input.tagId as string, input.value as TagValue);
      return successful({ tagId: input.tagId, value: input.value });
    case 'automation_changeset_preview':
      return executeBatch(request, input.operations as AutomationBatchOperation[], true);
    case 'automation_changeset_apply':
      return executeBatch(request, input.operations as AutomationBatchOperation[], Boolean(request.dryRun));
    case 'undo_last_agent_change':
      return undoLastAutomationChange();
    case 'auto_layout_fsm':
      return executeAutoLayout(request, input);
    case 'update_display_profile': {
      const profile = input.profile as DisplayProfile;
      const diagnostics = validateAutomationDisplayProfile(profile);
      return diagnostics.length ? { status: 'failure', diagnostics } : executeMappedCommand(request, input);
    }
    default:
      return executeMappedCommand(request, input);
  }
}

async function executeAutoLayout(request: AutomationRequest, input: Record<string, unknown>): Promise<DispatchResult> {
  const project = useProjectStore.getState().project;
  if (!project) return blocked('automation.no-project', 'No project loaded');
  const positions = await computeElkLayout(
    project.fsm.stateOrder.map((id) => ({ id, type: 'stateNode', position: project.fsm.graphLayout[id] ?? { x: 0, y: 0 }, data: {} })),
    project.fsm.transitionOrder.map((id) => ({ id, source: project.fsm.transitions[id].from, target: project.fsm.transitions[id].to })),
    (id) => project.fsm.states[id]?.subsystem ?? 'user',
    { direction: input.direction === 'TB' ? 'TB' : 'LR', nodeWidth: 220, nodeHeight: 72, paddingX: 80, paddingY: 60 }
  );
  const command = buildProjectCommands('auto_layout_fsm', { positions: Object.fromEntries(positions) }, metadata(request, 0))[0];
  return fromCommandResult(executeProjectStoreCommand(command, { dryRun: Boolean(request.dryRun) }), { stateCount: positions.size });
}

function executeMappedCommand(request: AutomationRequest, input: Record<string, unknown>): DispatchResult {
  const commands = buildProjectCommands(request.command, input, metadata(request, 0));
  if (commands.length === 0) return blocked('automation.unmapped-handler', `No application command mapping for ${request.command}`);
  if (commands.length === 1) return fromCommandResult(executeProjectStoreCommand(commands[0], { dryRun: Boolean(request.dryRun) }), outputFor(request.command, commands[0]));
  const project = useProjectStore.getState().project;
  if (!project) return blocked('automation.no-project', 'No project loaded');
  const changeSet: ProjectChangeSet = {
    changeSetId: `automation:${request.correlationId}`,
    projectId: project.meta.id,
    expectedRevision: request.expectedRevision!,
    commands,
    reason: request.command,
    timestamp: new Date().toISOString()
  };
  return fromCommandResult(executeProjectStoreChangeSet(changeSet, { dryRun: Boolean(request.dryRun) }), { commandCount: commands.length });
}

function executeBatch(request: AutomationRequest, operations: AutomationBatchOperation[], dryRun: boolean): DispatchResult {
  const project = useProjectStore.getState().project;
  if (!project) return blocked('automation.no-project', 'No project loaded');
  const commands: ProjectCommand[] = [];
  for (const [operationIndex, operation] of operations.entries()) {
    const definition = getAutomationDefinition(operation.command);
    const parsed = parseAutomationInput(operation.command, operation.input ?? {});
    if (!definition || definition.access === 'read' || !parsed?.success || definition.handler.startsWith('automation_changeset')) {
      return failed('automation.invalid-batch-operation', `Operation ${operationIndex} (${operation.command}) cannot be used in a ChangeSet.`);
    }
    if (!request.permissions.includes(definition.permission)) {
      return blocked('automation.permission-denied', `Operation ${operationIndex} requires permission "${definition.permission}".`);
    }
    const mappedCommands = buildProjectCommands(operation.command, parsed.data as Record<string, unknown>, metadata(request, operationIndex));
    if (mappedCommands.length === 0) {
      return failed('automation.invalid-batch-operation', `Operation ${operationIndex} (${operation.command}) has no atomic command mapping.`);
    }
    commands.push(...mappedCommands);
  }
  if (commands.length === 0) return blocked('automation.empty-changeset', 'No project commands were produced.');
  return fromCommandResult(executeProjectStoreChangeSet({
    changeSetId: `automation:${request.correlationId}`,
    projectId: project.meta.id,
    expectedRevision: request.expectedRevision!,
    commands,
    reason: request.command,
    timestamp: new Date().toISOString()
  }, { dryRun }), { commandCount: commands.length });
}

function undoLastAutomationChange(): DispatchResult {
  const state = useProjectStore.getState();
  const session = state.session;
  if (!session || session.history.cursor === 0) return { status: 'noop', diagnostics: [], output: { undone: false } };
  const entry = session.history.entries[session.history.cursor - 1];
  if (entry.actor.type !== 'adapter' || !entry.actor.id.startsWith('automation:')) {
    return blocked('automation.undo-not-owned', 'The latest history entry was not authored by automation.');
  }
  const next = undoProjectSession(session);
  if (!next) return { status: 'noop', diagnostics: [], output: { undone: false } };
  replaceProjectStoreSession(next);
  return { status: 'success', diagnostics: [], output: { undone: true, historyEntryId: entry.id } };
}

function buildProjectCommands(command: string, input: Record<string, unknown>, meta: CommandMetadata): ProjectCommand[] {
  const commandOf = (type: ProjectCommand['type'], payload: unknown, index = 0): ProjectCommand => ({
    type,
    meta: { ...meta, commandId: index === 0 ? meta.commandId : `${meta.commandId}:${index}` },
    payload
  } as ProjectCommand);
  switch (command) {
    case 'set_authoring_language': return [commandOf('project.setAuthoringLanguage', { language: input.language })];
    case 'update_display_profile': return [commandOf('project.updateDisplayConfig', { display: input.profile as DisplayProfile })];
    case 'create_fsm_state': return [commandOf('fsm.state.add', { title: input.title })];
    case 'update_fsm_state': return [commandOf('fsm.state.update', {
      stateId: input.stateId,
      updates: { ...asObject(input.updates), ...(input.title === undefined ? {} : { title: input.title }) } as Partial<FsmState>
    })];
    case 'delete_fsm_state': return [commandOf('fsm.state.delete', { stateId: input.stateId })];
    case 'create_fsm_transition': return [commandOf('fsm.transition.add', { from: input.from, to: input.to, eventId: input.eventId })];
    case 'update_fsm_transition': return [commandOf('fsm.transition.update', { transitionId: input.transitionId, updates: input.updates as Partial<FsmTransition> })];
    case 'delete_fsm_transition': return [commandOf('fsm.transition.delete', { transitionId: input.transitionId })];
    case 'create_fsm_event': return [commandOf('fsm.event.add', { name: input.name, scope: input.scope as FsmEvent['scope'], sourceStateId: input.sourceStateId })];
    case 'update_fsm_event': return [commandOf('fsm.event.update', { eventId: input.eventId, updates: input.updates })];
    case 'delete_fsm_event': return [commandOf('fsm.event.delete', { eventId: input.eventId })];
    case 'auto_layout_fsm': return [commandOf('fsm.graphPositions.update', { positions: input.positions })];
    case 'create_screen': return [commandOf('screen.create', { name: input.name })];
    case 'update_screen': {
      const result: ProjectCommand[] = [];
      if (input.name !== undefined) result.push(commandOf('screen.rename', { screenId: input.screenId, name: input.name }, result.length));
      if (input.width !== undefined || input.height !== undefined) {
        const screen = useProjectStore.getState().project?.screens[input.screenId as string];
        result.push(commandOf('screen.resize', { screenId: input.screenId, width: input.width ?? screen?.width, height: input.height ?? screen?.height }, result.length));
      }
      return result;
    }
    case 'delete_screen': return [commandOf('screen.delete', { screenId: input.screenId })];
    case 'reorder_screens': return [commandOf('screen.reorder', { screenIds: input.screenIds })];
    case 'update_control_panel_element': return [commandOf('controlPanel.element.update', { elementId: input.elementId, updates: input.updates as Partial<ControlPanelElement> })];
    case 'upsert_tag': return [commandOf('tag.upsert', { tag: input.tag as HmiTag })];
    case 'delete_tag': return [commandOf('tag.delete', { tagId: input.tagId })];
    case 'upsert_procedure': return [commandOf('procedure.upsert', { procedure: input.procedure as BackendProcedure })];
    case 'delete_procedure': return [commandOf('procedure.delete', { procedureId: input.procedureId })];
    case 'upsert_alarm': return [commandOf('alarm.upsert', { alarm: input.alarm as AlarmDefinition })];
    case 'delete_alarm': return [commandOf('alarm.delete', { alarmId: input.alarmId })];
    default: return [];
  }
}

function metadata(request: AutomationRequest, operationIndex: number): CommandMetadata {
  const project = useProjectStore.getState().project;
  if (!project) throw new Error('No project loaded');
  const key = request.idempotencyKey ?? request.correlationId;
  return {
    commandId: `automation:${request.source}:${key}:${operationIndex}`,
    projectId: project.meta.id,
    expectedRevision: request.expectedRevision!,
    actor: request.actor ?? { id: `automation:${request.source}`, type: 'adapter', displayName: request.source },
    reason: request.command,
    timestamp: new Date().toISOString()
  };
}

function outputFor(command: string, projectCommand: ProjectCommand): Record<string, unknown> {
  const payload = projectCommand.payload as Record<string, unknown>;
  return { command, ...payload };
}

function fromCommandResult(result: ProjectCommandResult | null, output?: unknown): DispatchResult {
  if (!result) return blocked('automation.no-project', 'No project loaded');
  const diagnostics = result.diagnostics.map((item) => ({ code: item.code, message: item.message }));
  if (result.status === 'rejected') {
    const conflict = diagnostics.some((item) => item.code.includes('revision') || item.code.includes('duplicate'));
    return { status: conflict ? 'conflict' : 'failure', diagnostics, result };
  }
  if (result.status === 'noop') return { status: 'noop', diagnostics, result, output };
  return { status: 'success', diagnostics, result, output: { ...asObject(output), candidateRevision: result.candidate?.revision ?? result.session.revision } };
}

function finish(
  request: AutomationRequest,
  definition: AutomationCommandDefinition,
  revisionBefore: number,
  status: AutomationOutcomeStatus,
  output: unknown,
  changes: AutomationOutcome['changes'],
  diagnostics: AutomationDiagnostic[]
): AutomationOutcome {
  const revisionAfter = useProjectStore.getState().revision;
  const actor = request.actor ?? { id: `automation:${request.source}`, type: 'adapter' as const, displayName: request.source };
  const audit: AutomationAuditEvent = {
    id: `audit:${request.correlationId}`,
    correlationId: request.correlationId,
    command: request.command,
    source: request.source,
    actor,
    access: definition.access,
    status,
    revisionBefore,
    revisionAfter,
    dryRun: Boolean(request.dryRun),
    timestamp: new Date().toISOString(),
    ...(request.idempotencyKey ? { idempotencyKey: request.idempotencyKey } : {}),
    diagnosticCodes: diagnostics.map((item) => item.code)
  };
  auditLog.unshift(audit);
  if (auditLog.length > MAX_AUDIT_EVENTS) auditLog.length = MAX_AUDIT_EVENTS;
  return {
    status,
    command: request.command,
    correlationId: request.correlationId,
    revisionBefore,
    revisionAfter,
    dryRun: Boolean(request.dryRun),
    ...(output === undefined ? {} : { output }),
    changes,
    diagnostics,
    audit
  };
}

function fallbackDefinition(name: string): AutomationCommandDefinition {
  return { name, description: '', inputSchema: {}, outputSchema: {}, access: 'read', idempotent: false, supportsDryRun: false, permission: 'project:read', handler: name };
}

function fallbackRequest(value: unknown): AutomationRequest {
  const candidate = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const source = typeof candidate.source === 'string' && ['ui', 'electron-rest', 'electron-mcp', 'tauri-rest', 'tauri-mcp', 'test'].includes(candidate.source)
    ? candidate.source as AutomationRequest['source']
    : 'test';
  return {
    command: typeof candidate.command === 'string' && candidate.command.trim() ? candidate.command : 'invalid-request',
    correlationId: typeof candidate.correlationId === 'string' && candidate.correlationId.trim()
      ? candidate.correlationId.slice(0, 256)
      : `invalid:${Date.now()}`,
    source,
    permissions: [],
    actor: { id: `automation:${source}`, type: 'adapter', displayName: source }
  };
}

function successful(output: unknown): DispatchResult { return { status: 'success', output, diagnostics: [] }; }
function failed(code: string, message: string): DispatchResult { return { status: 'failure', diagnostics: [{ code, message }] }; }
function blocked(code: string, message: string): DispatchResult { return { status: 'blocked', diagnostics: [{ code, message }] }; }
function ordered<T>(order: string[] | undefined, record: Record<string, T> | undefined): T[] {
  if (!record) return [];
  return (order ?? Object.keys(record)).map((id) => record[id]).filter((value): value is T => Boolean(value));
}
function asObject(value: unknown): Record<string, unknown> { return value && typeof value === 'object' ? value as Record<string, unknown> : {}; }
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}
function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
function rgbaBytesToRaster(bytes: Uint8Array, width: number, height: number) {
  if (bytes.length !== width * height * 4) throw new Error(`RGBA framebuffer needs ${width * height * 4} bytes, received ${bytes.length}.`);
  const pixels = new Uint32Array(width * height);
  for (let index = 0; index < pixels.length; index += 1) {
    pixels[index] = rgba(bytes[index * 4], bytes[index * 4 + 1], bytes[index * 4 + 2], bytes[index * 4 + 3]);
  }
  return createCanonicalRaster(width, height, pixels);
}
function validateAutomationDisplayProfile(profile: DisplayProfile): AutomationDiagnostic[] {
  const normalized = normalizeDisplayProfile(profile);
  if (normalized.fingerprint !== profile.fingerprint) {
    return [{ code: 'automation.display-profile-fingerprint', message: 'DisplayProfile fingerprint does not match its canonical fields.', path: 'profile.fingerprint' }];
  }
  return [];
}
function rememberIdempotentOutcome(key: string, outcome: AutomationOutcome): void {
  idempotencyCache.set(key, outcome);
  if (idempotencyCache.size > MAX_IDEMPOTENCY_ENTRIES) idempotencyCache.delete(idempotencyCache.keys().next().value as string);
}

export function resetAutomationDispatcherForTests(): void {
  auditLog.length = 0;
  idempotencyCache.clear();
}
