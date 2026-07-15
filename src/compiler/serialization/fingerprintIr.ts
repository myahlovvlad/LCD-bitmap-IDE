import { canonicalSerializeIr } from './canonicalSerializeIr';

export function fingerprintIr(value: unknown): string {
  return `fnv1a64:${fnv1a64(canonicalSerializeIr(value))}`;
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  const bytes = new TextEncoder().encode(value);
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, '0');
}
