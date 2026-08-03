/**
 * Creates a non-destructive normalized ECROS-5300VI/5310 project revision.
 *
 * This is intentionally an import-normalization tool, not a second project
 * model. It migrates the supplied .lcdproj, changes only the documented FSM
 * and HMI integration fields, then rebuilds bindings and validation using the
 * same domain services as the editor.
 *
 * Usage:
 *   npm run repair:ecros -- "C:\path\to\project.lcdproj" [output.lcdproj]
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createProjectFileV5, migrateProject } from '../src/services/projectMigrationService';
import { rebuildProjectBindings, type FsmEvent, type FsmTransition, type LcdBitmapProject } from '../src/domain/project';
import { validateProject } from '../src/services/projectValidationService';
import { ECROS_5300_DATA_SOURCES, ECROS_5300_HMI_TAGS } from '../src/spectrophotometer/ecros5300Profile';

const [inputPath, requestedOutputPath] = process.argv.slice(2);

if (!inputPath) {
  throw new Error('Usage: npm run repair:ecros -- <input.lcdproj> [output.lcdproj]');
}

const outputPath = requestedOutputPath ?? withSuffix(inputPath, '.ecros-repaired');
const source = JSON.parse(await readFile(inputPath, 'utf8')) as unknown;
const snapshot = migrateProject(source);
const project = repairEcrosProject(snapshot.project);
const file = createProjectFileV5({ ...snapshot, project }, snapshot.language ?? 'ru');

await writeFile(outputPath, `${JSON.stringify(file, null, 2)}\n`, 'utf8');

const issues = file.project.validation.issues;
console.log(JSON.stringify({
  inputPath,
  outputPath,
  validation: {
    errors: issues.filter((issue) => issue.severity === 'error').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length,
    issues
  },
  eventIds: file.project.fsm.eventOrder,
  tagCount: Object.keys(file.project.tags ?? {}).length
}, null, 2));

function repairEcrosProject(project: LcdBitmapProject): LcdBitmapProject {
  const initialStateId = 'mode-c-1-parral-copy-2';
  const events: Record<string, FsmEvent> = {
    'UI.MODE': semanticEvent('UI.MODE', 'Mode', 'Режим', '模式'),
    'UI.REFERENCE': semanticEvent('UI.REFERENCE', 'Reference / 0%T', 'Сравнение / 0%T', '参比 / 0%T'),
    'UI.ZERO_OR_100T': semanticEvent('UI.ZERO_OR_100T', 'Zero / 100%T', 'Нуль / 100%T', '调零 / 100%T'),
    'UI.CONFIRM': semanticEvent('UI.CONFIRM', 'Confirm', 'Ввод', '确认'),
    'SYSTEM.ZERO_COMPLETE': semanticEvent('SYSTEM.ZERO_COMPLETE', 'Zeroing complete', 'Обнуление завершено', '调零完成')
  };

  const transitionEventIds: Record<string, string> = {
    'transition-mode-c-1-parral-copy-2-mode-c-before-zero-copy-2': 'UI.ZERO_OR_100T',
    'transition-mode-c-1-parral-copy-copy-mode-c-zeroing-process-copy-2': 'UI.REFERENCE',
    'transition-mode-c-before-zero-copy-mode-c-zeroing-process-copy': 'SYSTEM.ZERO_COMPLETE',
    'transition-mode-c-1-parral-copy-2-screen-1785390472513-1': 'UI.MODE',
    'transition-mode-c-zeroing-process-copy-mode-c-1-parral-copy-copy': 'UI.CONFIRM',
    'transition-mode-c-1-parral-copy-copy-mode-c-1-parral-copy': 'UI.CONFIRM',
    'transition-mode-c-1-parral-copy-mode-c-2-parral-copy': 'UI.CONFIRM',
    'transition-mode-c-2-parral-copy-notification-c-mode-yes-copy': 'UI.ZERO_OR_100T',
    'transition-notification-c-mode-yes-copy-mode-c-before-zero-copy': 'UI.CONFIRM',
    'transition-mode-c-2-parral-copy-screen-9': 'UI.CONFIRM',
    'transition-screen-9-mode-c-2-parral-copy': 'UI.CONFIRM'
  };
  const buttonByEvent: Record<string, string | null> = {
    'UI.MODE': 'button',
    'UI.REFERENCE': 'button-2',
    'UI.ZERO_OR_100T': 'button-3',
    'UI.CONFIRM': 'button-4',
    'SYSTEM.ZERO_COMPLETE': null
  };

  const transitions: Record<string, FsmTransition> = Object.fromEntries(
    Object.entries(project.fsm.transitions)
      // This is a duplicate of the explicit ZERO_OR_100T button transition.
      .filter(([id]) => id !== 'transition-mode-c-1-parral-copy-2-mode-c-before-zero-copy')
      .map(([id, transition]) => {
        const eventId = transitionEventIds[id] ?? transition.trigger.eventId;
        const buttonId = buttonByEvent[eventId] ?? null;
        return [id, {
          ...transition,
          condition: null,
          trigger: {
            ...transition.trigger,
            eventId,
            mechanism: buttonId ? 'button' : 'event',
            buttonId
          }
        }];
      })
  );

  // The imported graph reaches Mode F through UI.MODE but had no return path.
  // Add the inverse user action so every visible interactive screen is reachable.
  transitions['transition-mode-f-return-to-c'] = {
    id: 'transition-mode-f-return-to-c',
    from: 'screen-1785390472513-1',
    to: initialStateId,
    kind: 'navigation',
    condition: null,
    source: 'user',
    backendProcessId: null,
    trigger: { eventId: 'UI.MODE', mechanism: 'button', buttonId: 'button', timerMs: null, fact: null }
  };

  const states = Object.fromEntries(Object.entries(project.fsm.states).map(([id, state]) => [id, {
    ...state,
    initial: id === initialStateId,
    terminal: false,
    stateType: id === initialStateId ? 'initial' : 'process'
  }]));
  const controlElements = Object.fromEntries(Object.entries(project.controlPanel.elements).map(([id, element]) => {
    if (element.type !== 'button') return [id, element];
    const fsmEventId = id === 'button'
      ? 'UI.MODE'
      : id === 'button-2'
        ? 'UI.REFERENCE'
        : id === 'button-3'
          ? 'UI.ZERO_OR_100T'
          : id === 'button-4'
            ? 'UI.CONFIRM'
            : element.fsmEventId;
    return [id, { ...element, fsmEventId }];
  }));

  const repaired: LcdBitmapProject = {
    ...project,
    meta: { ...project.meta, modelId: 'ecros-5300vi-5310', updatedAt: new Date().toISOString() },
    fsm: {
      ...project.fsm,
      states,
      transitions,
      transitionOrder: [...project.fsm.transitionOrder.filter((id) => Boolean(transitions[id])), 'transition-mode-f-return-to-c'],
      events,
      eventOrder: Object.keys(events)
    },
    controlPanel: { ...project.controlPanel, elements: controlElements },
    tags: { ...ECROS_5300_HMI_TAGS, ...(project.tags ?? {}) },
    dataSources: { ...ECROS_5300_DATA_SOURCES, ...(project.dataSources ?? {}) }
  };
  const withBindings = { ...repaired, bindings: rebuildProjectBindings(repaired) };
  return {
    ...withBindings,
    validation: { issues: validateProject(withBindings), validatedAt: new Date().toISOString() }
  };
}

function semanticEvent(id: string, en: string, ru: string, zh: string): FsmEvent {
  return { id, name: id, description: `${en} / ${ru} / ${zh}`, scope: 'global', sourceStateId: null };
}

function withSuffix(input: string, suffix: string): string {
  const parsed = path.parse(input);
  return path.join(parsed.dir, `${parsed.name}${suffix}${parsed.ext || '.lcdproj'}`);
}
