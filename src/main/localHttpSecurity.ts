import type { IncomingHttpHeaders } from 'node:http';

export const LOCAL_HTTP_MAX_BODY_BYTES = 10 * 1024 * 1024;

const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

export interface LocalHttpAccess {
  allowed: boolean;
  allowedOrigin: string | null;
  reason?: string;
}

export class RequestBodyTooLargeError extends Error {
  readonly statusCode = 413;

  constructor(readonly maxBytes: number) {
    super(`Request body exceeds the ${maxBytes}-byte limit`);
    this.name = 'RequestBodyTooLargeError';
  }
}

/**
 * Local HTTP servers still need Host and Origin validation. Binding to
 * 127.0.0.1 alone does not prevent a browser DNS-rebinding attack.
 */
export function evaluateLocalHttpAccess(
  headers: Pick<IncomingHttpHeaders, 'host' | 'origin'>,
  expectedPort: number
): LocalHttpAccess {
  const host = singleHeader(headers.host);
  if (!host || !isExpectedLocalHost(host, expectedPort)) {
    return { allowed: false, allowedOrigin: null, reason: 'Untrusted Host header' };
  }

  const origin = singleHeader(headers.origin);
  if (!origin) {
    return { allowed: true, allowedOrigin: null };
  }

  if (!isLocalOrigin(origin)) {
    return { allowed: false, allowedOrigin: null, reason: 'Untrusted Origin header' };
  }

  return { allowed: true, allowedOrigin: origin };
}

export async function readBoundedRequestBody(
  stream: AsyncIterable<Uint8Array | string>,
  maxBytes: number = LOCAL_HTTP_MAX_BODY_BYTES
): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of stream) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > maxBytes) {
      throw new RequestBodyTooLargeError(maxBytes);
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks, size).toString('utf8');
}

function isExpectedLocalHost(value: string, expectedPort: number): boolean {
  try {
    const parsed = new URL(`http://${value}`);
    return LOCAL_HOSTNAMES.has(parsed.hostname) && parsed.port === String(expectedPort);
  } catch {
    return false;
  }
}

function isLocalOrigin(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' && LOCAL_HOSTNAMES.has(parsed.hostname);
  } catch {
    return false;
  }
}

function singleHeader(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value.length === 1 ? value[0] : null;
  }
  return value ?? null;
}
