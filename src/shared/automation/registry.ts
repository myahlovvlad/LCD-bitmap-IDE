import { z } from 'zod';
import type { AutomationCommandDefinition, AutomationRequest, JsonSchema } from './contracts.js';

const emptyInput = z.object({}).strict();
const objectOutput = z.record(z.string(), z.unknown());
const identifier = z.string().trim().min(1).max(256);
const partialObject = z.record(z.string(), z.unknown());
const localizedText = z.object({
  en: z.string(),
  ru: z.string().optional(),
  zh: z.string().optional()
}).passthrough();

const tag = z.object({
  id: identifier,
  name: localizedText,
  dataType: z.enum(['float', 'int', 'bool', 'string'])
}).passthrough();

const procedure = z.object({
  id: identifier,
  name: localizedText,
  services: z.array(z.string()),
  steps: z.array(partialObject)
}).passthrough();

const alarm = z.object({
  id: identifier,
  name: localizedText,
  severity: z.enum(['info', 'warning', 'critical']),
  condition: partialObject,
  message: localizedText
}).passthrough();

const embeddedFormat = z.enum([
  'c-vertical-lsb', 'c-horizontal-msb', 'c-horizontal-lsb', 'xbm',
  'arduino-progmem', 'rust-embedded', 'esp-idf', 'binary'
]);

const batchOperation = z.object({ command: identifier, input: z.unknown().optional() }).strict();
const automationRequest = z.object({
  command: identifier,
  input: z.unknown().optional(),
  expectedRevision: z.number().int().nonnegative().optional(),
  idempotencyKey: z.string().trim().min(1).max(256).optional(),
  dryRun: z.boolean().optional(),
  correlationId: z.string().trim().min(1).max(256),
  source: z.enum(['ui', 'electron-rest', 'electron-mcp', 'tauri-rest', 'tauri-mcp', 'test']),
  permissions: z.array(z.string().trim().min(1).max(128)).max(32),
  actor: z.object({
    id: identifier,
    type: z.enum(['user', 'system', 'adapter']),
    displayName: z.string().trim().min(1).max(256).optional()
  }).strict().optional()
}).strict();

interface InternalDefinition extends AutomationCommandDefinition {
  inputValidator: z.ZodType;
  outputValidator: z.ZodType;
}

function definition(input: Omit<InternalDefinition, 'inputSchema' | 'outputSchema'>): InternalDefinition {
  return {
    ...input,
    inputSchema: z.toJSONSchema(input.inputValidator) as JsonSchema,
    outputSchema: z.toJSONSchema(input.outputValidator) as JsonSchema
  };
}

const read = (
  name: string,
  description: string,
  inputValidator: z.ZodType = emptyInput,
  handler = name
): InternalDefinition => definition({
  name, description, inputValidator, outputValidator: objectOutput,
  access: 'read', idempotent: true, supportsDryRun: false,
  permission: 'project:read', handler
});

const write = (
  name: string,
  description: string,
  inputValidator: z.ZodType,
  applicationCommands: string[],
  options: { destructive?: boolean; dryRun?: boolean; handler?: string; idempotent?: boolean } = {}
): InternalDefinition => definition({
  name, description, inputValidator, outputValidator: objectOutput,
  access: options.destructive ? 'destructive' : 'write',
  idempotent: options.idempotent ?? false,
  supportsDryRun: options.dryRun ?? true,
  permission: options.destructive ? 'project:destructive' : 'project:write',
  handler: options.handler ?? name,
  applicationCommands
});

const definitions: InternalDefinition[] = [
  read('get_capabilities', 'Returns the shared automation command registry and transport contract.'),
  read('get_project_revision', 'Returns the active project id and application revision.'),
  read('get_project_summary', 'Returns project metadata and entity counts.'),
  read('get_authoring_language', 'Returns the LCD content language, independent from the editor UI language.'),
  read('list_fsm_states', 'Returns FSM states in project order.'),
  read('list_fsm_transitions', 'Returns FSM transitions in project order.'),
  read('list_fsm_events', 'Returns FSM events in project order.'),
  read('list_screens', 'Returns LCD screens in canonical export order.'),
  read('get_screen', 'Returns one LCD screen.', z.object({ screenId: identifier }).strict()),
  read('list_control_panel_elements', 'Returns control-panel elements in visual order.'),
  read('validate_project', 'Runs validation without mutating the project revision.'),
  read('get_validation_report', 'Returns the validation report stored on the project.'),
  read('list_tags', 'Returns all HMI tags.'),
  read('list_procedures', 'Returns all backend procedures.'),
  read('list_alarms', 'Returns all alarm definitions.'),
  read('get_runtime_state', 'Returns the renderer runtime state.'),
  read('list_export_formats', 'Returns supported embedded export formats.'),
  read('get_automation_audit', 'Returns the bounded automation audit log.'),

  write('set_authoring_language', 'Changes the LCD content language.', z.object({ language: z.enum(['en', 'ru', 'zh']) }).strict(), ['project.setAuthoringLanguage']),
  write('create_fsm_state', 'Creates one FSM state and its screen atomically.', z.object({ title: z.string().trim().min(1).max(256).optional() }).strict(), ['fsm.state.add']),
  write('update_fsm_state', 'Updates an FSM state.', z.object({ stateId: identifier, updates: partialObject.optional(), title: z.string().trim().min(1).max(256).optional() }).strict().refine((value) => value.updates !== undefined || value.title !== undefined, { message: 'updates or title is required' }), ['fsm.state.update']),
  write('delete_fsm_state', 'Deletes an FSM state and linked transitions.', z.object({ stateId: identifier }).strict(), ['fsm.state.delete'], { destructive: true }),
  write('create_fsm_transition', 'Creates an FSM transition.', z.object({ from: identifier, to: identifier, eventId: identifier.optional() }).strict(), ['fsm.transition.add']),
  write('update_fsm_transition', 'Updates an FSM transition.', z.object({ transitionId: identifier, updates: partialObject }).strict(), ['fsm.transition.update']),
  write('delete_fsm_transition', 'Deletes an FSM transition.', z.object({ transitionId: identifier }).strict(), ['fsm.transition.delete'], { destructive: true }),
  write('create_fsm_event', 'Creates an FSM event.', z.object({ name: z.string().trim().min(1).max(256).optional(), scope: z.enum(['global', 'state']).optional(), sourceStateId: identifier.nullable().optional() }).strict(), ['fsm.event.add']),
  write('update_fsm_event', 'Updates an FSM event.', z.object({ eventId: identifier, updates: partialObject }).strict(), ['fsm.event.update']),
  write('delete_fsm_event', 'Deletes an unreferenced FSM event.', z.object({ eventId: identifier }).strict(), ['fsm.event.delete'], { destructive: true }),
  write('auto_layout_fsm', 'Calculates and applies the canonical ELK FSM layout.', z.object({ direction: z.enum(['LR', 'TB']).default('LR') }).strict(), ['fsm.graphPositions.update']),

  write('create_screen', 'Creates a screen and matching FSM state.', z.object({ name: z.string().trim().min(1).max(256).optional() }).strict(), ['screen.create']),
  write('update_screen', 'Renames and/or resizes a screen atomically.', z.object({ screenId: identifier, name: z.string().trim().min(1).max(256).optional(), width: z.number().int().min(16).max(512).optional(), height: z.number().int().min(16).max(512).optional() }).strict(), ['screen.rename', 'screen.resize']),
  write('delete_screen', 'Deletes a screen and its matching state.', z.object({ screenId: identifier }).strict(), ['screen.delete'], { destructive: true }),
  write('reorder_screens', 'Replaces the canonical screen export order.', z.object({ screenIds: z.array(identifier).min(1) }).strict(), ['screen.reorder']),
  write('update_control_panel_element', 'Updates one control-panel element.', z.object({ elementId: identifier, updates: partialObject }).strict(), ['controlPanel.element.update']),

  write('upsert_tag', 'Creates or updates an HMI tag.', z.object({ tag }).strict(), ['tag.upsert']),
  write('delete_tag', 'Deletes an HMI tag.', z.object({ tagId: identifier }).strict(), ['tag.delete'], { destructive: true }),
  write('upsert_procedure', 'Creates or updates a backend procedure.', z.object({ procedure }).strict(), ['procedure.upsert']),
  write('delete_procedure', 'Deletes a backend procedure.', z.object({ procedureId: identifier }).strict(), ['procedure.delete'], { destructive: true }),
  write('upsert_alarm', 'Creates or updates an alarm.', z.object({ alarm }).strict(), ['alarm.upsert']),
  write('delete_alarm', 'Deletes an alarm.', z.object({ alarmId: identifier }).strict(), ['alarm.delete'], { destructive: true }),

  read('compile_assets', 'Compiles selected or all screens to deterministic embedded artifacts.', z.object({ format: embeddedFormat, scope: z.enum(['selected-screen', 'all-screens']).default('all-screens'), screenId: identifier.optional() }).strict()),
  definition({
    name: 'compile_screen',
    description: 'Deprecated alias for compile_assets.',
    inputValidator: z.object({ format: embeddedFormat, scope: z.enum(['selected-screen', 'all-screens']).default('all-screens'), screenId: identifier.optional() }).strict(),
    outputValidator: objectOutput,
    access: 'read', idempotent: true, supportsDryRun: false, permission: 'project:read',
    handler: 'compile_assets', deprecatedAliasFor: 'compile_assets'
  }),
  definition({
    name: 'fire_runtime_event', description: 'Sends an event to the active runtime engine.',
    inputValidator: z.object({ eventId: identifier }).strict(), outputValidator: objectOutput,
    access: 'write', idempotent: false, supportsDryRun: false,
    permission: 'runtime:write', handler: 'fire_runtime_event', applicationCommands: []
  }),
  write('preview_changes', 'Validates and dry-runs an atomic automation ChangeSet.', z.object({ operations: z.array(batchOperation).min(1).max(100) }).strict(), [], { handler: 'automation_changeset_preview' }),
  write('apply_changes', 'Applies a previously previewable atomic automation ChangeSet.', z.object({ operations: z.array(batchOperation).min(1).max(100) }).strict(), [], { handler: 'automation_changeset_apply' }),
  write('undo_last_agent_change', 'Undoes the latest automation-authored history entry only.', emptyInput, [], { dryRun: false, handler: 'undo_last_agent_change', idempotent: false })
];

const byName = new Map(definitions.map((item) => [item.name, item]));

export function getAutomationDefinition(name: string): InternalDefinition | undefined {
  return byName.get(name);
}

export function getAutomationCapabilities(): AutomationCommandDefinition[] {
  return definitions.map(({ inputValidator: _input, outputValidator: _output, ...item }) => item);
}

export function getMcpToolDefinitions(): Array<{ name: string; description: string; inputSchema: JsonSchema }> {
  return definitions.map((item) => ({
    name: item.name,
    description: item.description,
    inputSchema: withAutomationEnvelope(item)
  }));
}

function withAutomationEnvelope(item: InternalDefinition): JsonSchema {
  const schema = structuredClone(item.inputSchema);
  const properties = (schema.properties ?? {}) as Record<string, unknown>;
  schema.properties = {
    ...properties,
    expectedRevision: { type: 'integer', minimum: 0, description: 'Required for write and destructive operations.' },
    idempotencyKey: { type: 'string', minLength: 1, maxLength: 256 },
    dryRun: { type: 'boolean', default: false }
  };
  if (item.access !== 'read') {
    schema.required = [...new Set([...(Array.isArray(schema.required) ? schema.required as string[] : []), 'expectedRevision'])];
  }
  return schema;
}

export function parseAutomationInput(name: string, input: unknown) {
  return byName.get(name)?.inputValidator.safeParse(input ?? {}) ?? null;
}

export function parseAutomationOutput(name: string, output: unknown) {
  return byName.get(name)?.outputValidator.safeParse(output ?? {}) ?? null;
}

export function parseAutomationRequest(value: unknown) {
  return automationRequest.safeParse(value) as ReturnType<typeof automationRequest.safeParse> & {
    data?: AutomationRequest;
  };
}

export const AUTOMATION_COMMAND_NAMES = definitions.map((item) => item.name) as readonly string[];
