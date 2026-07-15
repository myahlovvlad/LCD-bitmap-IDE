export function encodeValue(value: string | number | boolean | null | undefined): string {
  if (value === undefined) {
    return '';
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

export function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const regex = /([A-Za-z_][A-Za-z0-9_-]*)=("(?:\\.|[^"])*"|[^\s]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source)) !== null) {
    attributes[match[1]] = decodeValue(match[2]);
  }
  return attributes;
}

export function attributeList(attributes: Record<string, string | number | boolean | null | undefined>): string {
  return Object.entries(attributes)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${encodeValue(value)}`)
    .join(' ');
}

export function decodeValue(value: string | undefined): string {
  if (!value || value === 'null') {
    return '';
  }
  const normalized = value.endsWith(',') ? value.slice(0, -1) : value;
  if (normalized === 'null') {
    return '';
  }
  if (normalized.startsWith('"')) {
    try {
      return JSON.parse(normalized) as string;
    } catch {
      return normalized.slice(1, -1);
    }
  }
  return normalized;
}

export function boolValue(value: string | undefined): boolean {
  return value === 'true';
}

export function nullableValue(value: string | undefined): string | null {
  return !value || value === 'null' ? null : value;
}

export function numberValue(value: string | undefined, fallback = 0): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
