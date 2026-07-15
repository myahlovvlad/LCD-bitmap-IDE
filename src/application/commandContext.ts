import type { ValidationIssue } from '../domain/project';
import { validateProject } from '../services/projectValidationService';
import type { LcdBitmapProject } from '../domain/project';

export interface ApplicationCommandContext {
  now: () => string;
  createId: (record: Record<string, unknown>, prefix: string) => string;
  validateProject: (project: LcdBitmapProject) => ValidationIssue[];
}

export function createDefaultApplicationCommandContext(): ApplicationCommandContext {
  return {
    now: () => new Date().toISOString(),
    createId: uniqueId,
    validateProject
  };
}

export function createFixedApplicationCommandContext(timestamp: string): ApplicationCommandContext {
  return {
    now: () => timestamp,
    createId: uniqueId,
    validateProject
  };
}

function uniqueId(record: Record<string, unknown>, prefix: string): string {
  const base = slug(prefix);
  let id = base;
  let suffix = 2;
  while (record[id]) {
    id = `${base}-${suffix++}`;
  }
  return id;
}

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}
