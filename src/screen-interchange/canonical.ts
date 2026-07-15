import type { ScreenInterchangeProjectV1 } from './model';

export function canonicalizeScreenInterchange(packageV1: ScreenInterchangeProjectV1): ScreenInterchangeProjectV1 {
  return sortObjectKeys(packageV1) as ScreenInterchangeProjectV1;
}

export function serializeScreenInterchange(packageV1: ScreenInterchangeProjectV1): string {
  return `${JSON.stringify(canonicalizeScreenInterchange(packageV1))}\n`;
}

export function fingerprintScreenInterchange(packageV1: ScreenInterchangeProjectV1): string {
  return `simv1-${fnv1a64(serializeScreenInterchange(packageV1))}`;
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortObjectKeys(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortObjectKeys(item)])
  );
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = (hash * prime) & mask;
  }

  return hash.toString(16).padStart(16, '0');
}
