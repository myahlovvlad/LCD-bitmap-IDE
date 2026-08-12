import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { migrateProject } from '../src/services/projectMigrationService';

const root = process.cwd();
const ecrosRoot = resolve(root, 'ECROS-5400UV');
const target = resolve(ecrosRoot, 'ECROS-5400UV_FSM_12-08-2026-runtime-complete.lcdproj');
const backups = resolve(ecrosRoot, 'backups');
const reports = resolve(ecrosRoot, 'reports');

const sha = (file: string): string => createHash('sha256').update(readFileSync(file)).digest('hex');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

async function main(): Promise<void> {
  const snapshot = JSON.parse(readFileSync(target, 'utf8'));
  const migrated = migrateProject(snapshot);
  const project = migrated.project;
  const layerIds = project.fsm.layerOrder?.filter((id) => Boolean(project.fsm.layers?.[id])) ?? [];
  if (!layerIds.length) throw new Error('ECROS project has no existing layer catalogue. No preset can be inferred safely.');
  const existing = project.fsm.visibilityPresets ?? {};
  const missing = layerIds.filter((layerId) => !Object.values(existing).some((preset) => preset.layerIds.length === 1 && preset.layerIds[0] === layerId));
  if (!missing.length) {
    console.log('Layer presets already cover every existing layer.');
    return;
  }

  await mkdir(backups, { recursive: true });
  await mkdir(reports, { recursive: true });
  const backup = resolve(backups, `ECROS-5400UV_FSM_PRE-LAYER-PRESETS_${timestamp}.lcdproj`);
  copyFileSync(target, backup);
  if (!existsSync(backup) || !readFileSync(backup).length) throw new Error('Layer-preset backup was not created correctly.');
  JSON.parse(readFileSync(backup, 'utf8'));

  const presets = { ...existing };
  for (const layerId of missing) {
    const layer = project.fsm.layers?.[layerId];
    presets[`preset-layer-${layerId}`] = {
      id: `preset-layer-${layerId}`,
      name: layer?.name ?? layerId,
      layerIds: [layerId]
    };
  }
  project.fsm.visibilityPresets = presets;
  const transformed = { ...snapshot, project };
  // Structural validation happens before replacing the target.
  const verified = migrateProject(transformed).project;
  if (Object.keys(verified.fsm.visibilityPresets ?? {}).length !== Object.keys(presets).length) {
    throw new Error('Layer preset structural validation failed.');
  }
  const temporary = `${target}.${timestamp}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(transformed, null, 2)}\n`);
  JSON.parse(readFileSync(temporary, 'utf8'));
  renameSync(temporary, target);

  const changeLog = resolve(reports, 'change-log.md');
  const entry = `\n## Layer visibility presets (${new Date().toISOString()})\n\n- Backup: ${backup}\n- SHA-256 before: ${sha(backup)}\n- Added one single-layer visibility preset for each existing layer: ${missing.join(', ')}\n- Total presets: ${Object.keys(presets).length}\n- SHA-256 after: ${sha(target)}\n`;
  writeFileSync(changeLog, `${readFileSync(changeLog, 'utf8').trimEnd()}\n${entry}`);
  console.log(JSON.stringify({ backup, added: missing, presets: Object.keys(presets).length, sha256: sha(target) }, null, 2));
}

void main();
