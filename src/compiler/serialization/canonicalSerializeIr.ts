export type CanonicalJsonValue =
  | null
  | string
  | number
  | boolean
  | readonly CanonicalJsonValue[]
  | { readonly [key: string]: CanonicalJsonValue };

export function canonicalSerializeValue(value: unknown): string {
  return JSON.stringify(toCanonicalValue(value));
}

export function canonicalSerializeIr(value: unknown): string {
  return canonicalSerializeValue(value);
}

function toCanonicalValue(value: unknown): CanonicalJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => toCanonicalValue(item));
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .reduce<Record<string, CanonicalJsonValue>>((result, key) => {
        result[key] = toCanonicalValue(record[key]);
        return result;
      }, {});
  }
  return null;
}
