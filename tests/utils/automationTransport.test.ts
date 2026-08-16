import { afterEach, describe, expect, it } from 'vitest';
import {
  authorizeLocalAutomation,
  createAutomationRequest,
  splitMcpArguments
} from '../../src/main/automationTransport';

afterEach(() => {
  delete process.env.LCD_IDE_AUTOMATION_TOKEN;
});

describe('automation transport envelope', () => {
  it('supports an optional local bearer token and bounded scope selection', () => {
    process.env.LCD_IDE_AUTOMATION_TOKEN = 'secret-token';
    expect(authorizeLocalAutomation({ authorization: 'Bearer wrong' }).allowed).toBe(false);
    expect(authorizeLocalAutomation({
      authorization: 'Bearer secret-token',
      'x-lcd-ide-scopes': 'project:read project:write arbitrary:scope'
    })).toEqual({ allowed: true, permissions: ['project:read', 'project:write'] });
  });

  it('does not invent expectedRevision for the versioned API', () => {
    const request = createAutomationRequest('set_authoring_language', {
      input: { language: 'ru' },
      correlationId: 'client-correlation'
    }, {}, 'electron-rest');
    expect(request.expectedRevision).toBeUndefined();
    expect(request.correlationId).toBe('client-correlation');
  });

  it('separates MCP envelope metadata from validated command input', () => {
    expect(splitMcpArguments({
      language: 'zh',
      expectedRevision: 7,
      idempotencyKey: 'language-zh',
      dryRun: true
    })).toEqual({
      input: { language: 'zh' },
      expectedRevision: 7,
      idempotencyKey: 'language-zh',
      dryRun: true,
      correlationId: undefined
    });
  });
});
