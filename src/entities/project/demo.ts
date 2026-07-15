/**
 * @module entities/project/demo
 * @description Bundled demo project with a glyph test screen and laboratory LCD
 * workflow screens. It is intentionally separate from autosaved user projects.
 */

import { DEFAULT_DISPLAY_CONFIG, type ImportedProjectModel, type LegacyProject as Project, type TextCanvasObject } from '../../domain';

function text(id: string, en: string, ru: string, zh: string, x: number, y: number, zIndex: number): TextCanvasObject {
  return {
    id,
    type: 'text',
    text: { en, ru, zh },
    x,
    y,
    fontVariant: '1',
    pendingTranslation: false,
    zIndex,
    visible: true,
    locked: false,
    source: 'prototype'
  };
}

/** Creates a deterministic demo project for QA and onboarding. */
export function createDemoProject(): ImportedProjectModel {
  const now = '2026-06-01T00:00:00.000Z';
  const stateOrder = ['main-menu', 'measure', 'save-result', 'error', 'glyph-test'];
  const states = Object.fromEntries(stateOrder.map((id, index) => [
    id,
    {
      id,
      runtimeId: null,
      legacyIds: [],
      title: ['Main Menu Demo', 'Measurement', 'Save Result', 'Error', 'Glyph Test Screen'][index],
      subsystem: 'demo',
      stateType: 'screen',
      origin: 'bundled-demo',
      sourceLcd: [],
      initial: index === 0,
      final: id === 'save-result'
    }
  ]));
  const transitions = {
    'tr-main-measure': { id: 'tr-main-measure', from: 'main-menu', to: 'measure', trigger: 'START', kind: 'navigation', condition: null, source: 'demo', cliCommands: [] },
    'tr-measure-save': { id: 'tr-measure-save', from: 'measure', to: 'save-result', trigger: 'SAVE', kind: 'navigation', condition: null, source: 'demo', cliCommands: [] },
    'tr-measure-error': { id: 'tr-measure-error', from: 'measure', to: 'error', trigger: 'ERR', kind: 'navigation', condition: null, source: 'demo', cliCommands: [] },
    'tr-error-main': { id: 'tr-error-main', from: 'error', to: 'main-menu', trigger: 'ESC', kind: 'navigation', condition: null, source: 'demo', cliCommands: [] }
  };
  const canvasByStateId = {
    'main-menu': {
      stateId: 'main-menu',
      width: 128,
      height: 64,
      objects: [
        text('main-title', 'UNIVERSAL LCD', 'LCD СИМУЛЯТОР', '通用 LCD', 2, 3, 0),
        text('main-1', '> Photometry', '> Фотометрия', '> 光度测量', 2, 18, 1),
        text('main-2', '  Settings', '  Настройки', '  设置', 2, 29, 2)
      ],
      selectedObjectIds: [],
      updatedAt: now
    },
    measure: {
      stateId: 'measure',
      width: 128,
      height: 64,
      objects: [
        text('measure-title', 'MEASURING...', 'ИЗМЕРЕНИЕ...', '测量中...', 2, 6, 0),
        text('measure-wl', 'λ=540 nm', 'λ=540 нм', 'λ=540 nm', 2, 24, 1),
        text('measure-a', 'A=0.124', 'A=0.124', 'A=0.124', 2, 38, 2)
      ],
      selectedObjectIds: [],
      updatedAt: now
    },
    'save-result': {
      stateId: 'save-result',
      width: 128,
      height: 64,
      objects: [text('save-title', 'SAVED', 'СОХРАНЕНО', '已保存', 36, 24, 0)],
      selectedObjectIds: [],
      updatedAt: now
    },
    error: {
      stateId: 'error',
      width: 128,
      height: 64,
      objects: [
        text('err-title', 'ERROR', 'ОШИБКА', '错误', 42, 16, 0),
        text('err-body', 'Check cuvette', 'Проверьте кювету', '检查样品池', 2, 34, 1)
      ],
      selectedObjectIds: [],
      updatedAt: now
    },
    'glyph-test': {
      stateId: 'glyph-test',
      width: 128,
      height: 64,
      objects: [
        text('glyph-ru', 'Съешь ещё этих мягких', 'Съешь ещё этих мягких', 'Glyph test', 2, 2, 0),
        text('glyph-num', '1234567890 №= λ', '1234567890 №= λ', '1234567890', 2, 18, 1),
        text('glyph-special', '☐ ☑ ✓ ×', '☐ ☑ ✓ ×', '☐ ☑ ✓ ×', 2, 34, 2)
      ],
      selectedObjectIds: [],
      updatedAt: now
    }
  };
  const project: Project = {
    id: 'universal-lcd-demo',
    name: 'Universal LCD Demo Project',
    version: '1.0.0',
    modelId: 'Universal-LCD-128x64',
    firmwareVersion: null,
    author: 'SpectroDesigner',
    lastModified: now,
    display: DEFAULT_DISPLAY_CONFIG,
    states: states as Project['states'],
    transitions,
    canvasByStateId,
    graphLayout: Object.fromEntries(stateOrder.map((id, index) => [id, { x: 80 + index * 170, y: 80 + (index % 2) * 120 }])),
    auditTrail: []
  };
  return { project, stateOrder, transitionOrder: Object.keys(transitions) };
}
