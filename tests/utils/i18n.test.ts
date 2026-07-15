import { describe, expect, it } from 'vitest';
import { UI_TEXT } from '../../src/renderer/config/i18n';
import { OPERATION_MANUAL_BY_LANGUAGE } from '../../src/renderer/config/operationManual';

describe('trilingual UI resources', () => {
  it('keeps the same translation keys in every locale', () => {
    const englishKeys = Object.keys(UI_TEXT.en).sort();
    expect(Object.keys(UI_TEXT.ru).sort()).toEqual(englishKeys);
    expect(Object.keys(UI_TEXT.zh).sort()).toEqual(englishKeys);
  });

  it('contains no replacement characters or common UTF-8/CP1251 mojibake', () => {
    const serialized = JSON.stringify({ UI_TEXT, OPERATION_MANUAL_BY_LANGUAGE });
    expect(serialized).not.toContain('�');
    expect(serialized).not.toMatch(/(?:Р.|С.){4,}/);
  });

  it('keeps the manual structure aligned across all three languages', () => {
    const shape = (language: keyof typeof OPERATION_MANUAL_BY_LANGUAGE) =>
      OPERATION_MANUAL_BY_LANGUAGE[language].map((section) => ({
        id: section.id,
        blocks: section.blocks.map((block) => block.kind)
      }));
    expect(shape('ru')).toEqual(shape('en'));
    expect(shape('zh')).toEqual(shape('en'));
  });
});
