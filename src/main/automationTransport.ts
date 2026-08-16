import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import type { AutomationOutcome, AutomationRequest, AutomationSource } from '../shared/automation/contracts.js';

const ALL_LOCAL_SCOPES = ['project:read', 'project:write', 'project:destructive', 'runtime:write'];
const MAX_CORRELATION_ID_LENGTH = 256;

export interface AutomationEnvelopeInput {
  input?: unknown;
  expectedRevision?: unknown;
  idempotencyKey?: unknown;
  dryRun?: unknown;
  correlationId?: unknown;
}

export function authorizeLocalAutomation(headers: IncomingHttpHeaders): { allowed: true; permissions: string[] } | { allowed: false; message: string } {
  const configuredToken = process.env.LCD_IDE_AUTOMATION_TOKEN;
  if (configuredToken) {
    const authorization = singleHeader(headers.authorization);
    const supplied = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!safeEqual(configuredToken, supplied)) return { allowed: false, message: 'Missing or invalid local automation token' };
  }
  const requestedScopes = singleHeader(headers['x-lcd-ide-scopes'])
    ?.split(/[ ,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
  const permissions = requestedScopes?.length
    ? requestedScopes.filter((scope) => ALL_LOCAL_SCOPES.includes(scope))
    : [...ALL_LOCAL_SCOPES];
  return { allowed: true, permissions };
}

export function createAutomationRequest(
  command: string,
  envelope: AutomationEnvelopeInput,
  headers: IncomingHttpHeaders,
  source: AutomationSource,
  fallbackRevision?: number
): AutomationRequest {
  const authorization = authorizeLocalAutomation(headers);
  if (!authorization.allowed) throw new AutomationAuthorizationError(authorization.message);
  const correlationId = typeof envelope.correlationId === 'string' && envelope.correlationId.length <= MAX_CORRELATION_ID_LENGTH
    ? envelope.correlationId
    : randomUUID();
  const expectedRevision = typeof envelope.expectedRevision === 'number' ? envelope.expectedRevision : fallbackRevision;
  return {
    command,
    input: envelope.input ?? {},
    ...(expectedRevision === undefined ? {} : { expectedRevision }),
    ...(typeof envelope.idempotencyKey === 'string' ? { idempotencyKey: envelope.idempotencyKey } : {}),
    dryRun: envelope.dryRun === true,
    correlationId,
    source,
    permissions: authorization.permissions,
    actor: { id: `automation:${source}`, type: 'adapter', displayName: source }
  };
}

export function splitMcpArguments(argumentsValue: Record<string, unknown>): AutomationEnvelopeInput {
  const { expectedRevision, idempotencyKey, dryRun, correlationId, ...input } = argumentsValue;
  return { input, expectedRevision, idempotencyKey, dryRun, correlationId };
}

export function automationHttpStatus(outcome: AutomationOutcome): number {
  switch (outcome.status) {
    case 'success': case 'noop': return 200;
    case 'conflict': return 409;
    case 'blocked': return 403;
    case 'cancelled': return 409;
    case 'failure': return 400;
  }
}

export class AutomationAuthorizationError extends Error {
  readonly statusCode = 401;
}

function safeEqual(expected: string, supplied: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function singleHeader(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value.length === 1 ? value[0] : null;
  return value ?? null;
}
