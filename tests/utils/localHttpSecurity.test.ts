import { Readable } from 'node:stream';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  evaluateLocalHttpAccess,
  readBoundedRequestBody,
  RequestBodyTooLargeError
} from '../../src/main/localHttpSecurity';

describe('local REST/MCP transport security', () => {
  it('allows native localhost clients without a browser Origin header', () => {
    expect(evaluateLocalHttpAccess({ host: '127.0.0.1:8766' }, 8766)).toEqual({
      allowed: true,
      allowedOrigin: null
    });
  });

  it('echoes only trusted localhost browser origins', () => {
    expect(evaluateLocalHttpAccess({
      host: 'localhost:8767',
      origin: 'http://localhost:5173'
    }, 8767)).toEqual({
      allowed: true,
      allowedOrigin: 'http://localhost:5173'
    });
  });

  it('rejects remote origins and DNS-rebinding Host headers', () => {
    expect(evaluateLocalHttpAccess({
      host: '127.0.0.1:8767',
      origin: 'https://attacker.example'
    }, 8767).allowed).toBe(false);
    expect(evaluateLocalHttpAccess({
      host: 'attacker.example:8767'
    }, 8767).allowed).toBe(false);
  });

  it('limits request bodies before buffering them completely', async () => {
    await expect(readBoundedRequestBody(Readable.from(['1234', '5678']), 7))
      .rejects.toBeInstanceOf(RequestBodyTooLargeError);
    await expect(readBoundedRequestBody(Readable.from(['1234', '5678']), 8))
      .resolves.toBe('12345678');
  });

  it('does not restore wildcard CORS in either local server', () => {
    const root = process.cwd();
    const sources = [
      readFileSync(path.join(root, 'src/main/api/apiServer.ts'), 'utf8'),
      readFileSync(path.join(root, 'src/main/mcp/mcpServer.ts'), 'utf8')
    ];
    for (const source of sources) {
      expect(source).not.toContain("'Access-Control-Allow-Origin': '*'");
      expect(source).toContain('evaluateLocalHttpAccess');
    }
  });
});
