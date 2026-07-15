import type { HmiTag, ValueExpression } from '../../domain/tag';

export type TagValue = string | number | boolean | null;

export interface TagContext {
  get(tagId: string): TagValue;
  set(tagId: string, value: TagValue): void;
  snapshot(): Record<string, TagValue>;
}

export class MutableTagContext implements TagContext {
  private readonly store = new Map<string, TagValue>();

  constructor(initial?: Record<string, TagValue>) {
    if (initial) {
      for (const [id, value] of Object.entries(initial)) {
        this.store.set(id, value);
      }
    }
  }

  get(tagId: string): TagValue {
    return this.store.get(tagId) ?? null;
  }

  set(tagId: string, value: TagValue): void {
    this.store.set(tagId, value);
  }

  snapshot(): Record<string, TagValue> {
    return Object.fromEntries(this.store.entries());
  }
}

export function evaluateExpression(expr: ValueExpression, tags: TagContext): TagValue {
  switch (expr.kind) {
    case 'literal':
      return expr.value;
    case 'tag':
      return tags.get(expr.tagId);
    case 'formula':
      return evaluateFormula(expr.expression, expr.deps, tags);
  }
}

function evaluateFormula(expression: string, deps: string[], tags: TagContext): TagValue {
  try {
    const args = deps.map((dep) => tags.get(dep) ?? 0);
    const fn = new Function(...deps, `return (${expression});`) as (...args: TagValue[]) => TagValue;
    const result = fn(...args);
    return typeof result === 'string' || typeof result === 'number' || typeof result === 'boolean'
      ? result
      : null;
  } catch {
    return null;
  }
}

export function defaultTagValues(tags: Record<string, HmiTag>): Record<string, TagValue> {
  const result: Record<string, TagValue> = {};
  for (const tag of Object.values(tags)) {
    switch (tag.dataType) {
      case 'float':
      case 'int':
        result[tag.id] = 0;
        break;
      case 'bool':
        result[tag.id] = false;
        break;
      case 'string':
        result[tag.id] = '';
        break;
    }
  }
  return result;
}
