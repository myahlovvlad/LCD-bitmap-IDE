/**
 * Text Registry — centralized dictionary of all screen text labels.
 *
 * Scans all LcdScreen objects in the project, extracts every TextCanvasObject,
 * and presents them as an editable table with RU/EN/ZH columns.
 *
 * Features:
 *  - Inline editing: changes propagate back to the screen canvas object
 *  - Search/filter by screen or text content
 *  - Export to CSV for translators / documentation
 *  - Status indicator: untranslated (empty EN or ZH), translated, custom
 */

import type React from 'react';
import { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { useProjectStore } from '../../renderer/store/projectStore';
import { UI_TEXT } from '../../renderer/config/i18n';
import type { TextCanvasObject } from '../../renderer/types/domain';

interface TextEntry {
  screenId: string;
  screenName: string;
  objectId: string;
  ru: string;
  en: string;
  zh: string;
  subsystem: string;
}

function buildTextEntries(
  screens: Record<string, { id: string; name: string; objects: TextCanvasObject[] }>,
  screenOrder: string[],
  states: Record<string, { id: string; title: string; subsystem?: string; screenId?: string | null }>
): TextEntry[] {
  // Build screenId → subsystem map
  const screenToSubsystem: Record<string, string> = {};
  for (const state of Object.values(states)) {
    if (state.screenId) {
      screenToSubsystem[state.screenId] = state.subsystem ?? '';
    }
  }

  const entries: TextEntry[] = [];
  for (const screenId of screenOrder) {
    const screen = screens[screenId];
    if (!screen) continue;
    const textObjects = screen.objects.filter((o): o is TextCanvasObject => o.type === 'text');
    for (const obj of textObjects) {
      entries.push({
        screenId,
        screenName: screen.name || screenId,
        objectId: obj.id,
        ru: obj.text.ru ?? '',
        en: obj.text.en ?? '',
        zh: obj.text.zh ?? '',
        subsystem: screenToSubsystem[screenId] ?? '',
      });
    }
  }
  return entries;
}

function exportCsv(entries: TextEntry[]): void {
  const header = ['Screen ID', 'Screen Name', 'Object ID', 'Subsystem', 'RU', 'EN', 'ZH'];
  const rows = entries.map((e) => [
    e.screenId, e.screenName, e.objectId, e.subsystem, e.ru, e.en, e.zh
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
  const csv = [header.join(','), ...rows].join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'text_registry.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function TextRegistryWorkspace(): React.ReactElement {
  const { project, language, updateCanvasObject } = useProjectStore();
  const labels = UI_TEXT[language];
  const [search, setSearch] = useState('');
  const [filterSubsystem, setFilterSubsystem] = useState('');
  const [editingCell, setEditingCell] = useState<{ id: string; field: 'ru' | 'en' | 'zh' } | null>(null);

  if (!project) {
    return <section className="workspace-empty">{labels.noProjectLoaded}</section>;
  }

  const allEntries = useMemo(() =>
    buildTextEntries(
      project.screens as unknown as Record<string, { id: string; name: string; objects: TextCanvasObject[] }>,
      project.screenOrder,
      project.fsm.states as unknown as Record<string, { id: string; title: string; subsystem?: string; screenId?: string | null }>
    ),
    [project.screens, project.screenOrder, project.fsm.states]
  );

  const subsystems = useMemo(() =>
    [...new Set(allEntries.map((e) => e.subsystem).filter(Boolean))].sort(),
    [allEntries]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allEntries.filter((e) => {
      if (filterSubsystem && e.subsystem !== filterSubsystem) return false;
      if (!q) return true;
      return e.screenName.toLowerCase().includes(q) ||
        e.ru.toLowerCase().includes(q) ||
        e.en.toLowerCase().includes(q) ||
        e.zh.toLowerCase().includes(q) ||
        e.screenId.toLowerCase().includes(q);
    });
  }, [allEntries, search, filterSubsystem]);

  const untranslated = filtered.filter((e) => !e.en || !e.zh).length;

  const commitEdit = (entry: TextEntry, field: 'ru' | 'en' | 'zh', value: string): void => {
    const screen = project.screens[entry.screenId];
    if (!screen) return;
    const obj = screen.objects.find((o) => o.id === entry.objectId);
    if (!obj || obj.type !== 'text') return;
    updateCanvasObject(entry.screenId, {
      ...obj,
      text: { ...obj.text, [field]: value }
    });
  };

  const cellKey = (e: TextEntry, f: string): string => `${e.screenId}:${e.objectId}:${f}`;

  return (
    <section className="workspace-root text-registry-workspace" aria-label="Text Registry">
      <header className="workspace-section-header text-registry-header">
        <h2>
          {language === 'ru' ? 'Реестр текстов' : language === 'zh' ? '文本注册表' : 'Text Registry'}
          <span className="text-registry-count">
            {allEntries.length} {language === 'ru' ? 'строк' : 'strings'}
            {untranslated > 0 ? ` · ${untranslated} ${language === 'ru' ? 'без перевода' : 'untranslated'}` : ''}
          </span>
        </h2>
        <div className="text-registry-toolbar">
          <div className="sidebar-search">
            <Search size={14} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={language === 'ru' ? 'Поиск по тексту или ID экрана…' : 'Search text or screen ID…'}
            />
          </div>
          <select
            value={filterSubsystem}
            onChange={(e) => setFilterSubsystem(e.target.value)}
          >
            <option value="">{language === 'ru' ? 'Все подсистемы' : 'All subsystems'}</option>
            {subsystems.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            type="button"
            className="hmi-btn-primary"
            onClick={() => exportCsv(filtered)}
            title={language === 'ru' ? 'Экспорт в CSV (с BOM для Excel)' : 'Export to CSV (BOM for Excel)'}
          >
            <Download size={14} />
            CSV
          </button>
        </div>
      </header>

      <div className="text-registry-table-wrap">
        <table className="text-registry-table">
          <thead>
            <tr>
              <th>{language === 'ru' ? 'Экран' : 'Screen'}</th>
              <th>{language === 'ru' ? 'Подсистема' : 'Subsystem'}</th>
              <th>RU</th>
              <th>EN</th>
              <th>ZH</th>
              <th>{language === 'ru' ? 'Статус' : 'Status'}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => {
              const key = `${entry.screenId}:${entry.objectId}`;
              const missing = !entry.en || !entry.zh;
              const empty = !entry.ru && !entry.en && !entry.zh;
              return (
                <tr
                  key={key}
                  className={missing ? 'text-registry-row-warn' : ''}
                >
                  <td className="text-registry-screen">
                    <strong>{entry.screenName}</strong>
                    <small>{entry.screenId}</small>
                  </td>
                  <td className="text-registry-subsystem">
                    {entry.subsystem ? (
                      <span className="text-registry-badge">{entry.subsystem}</span>
                    ) : null}
                  </td>
                  {(['ru', 'en', 'zh'] as const).map((lang) => {
                    const ck = cellKey(entry, lang);
                    const isEditing = editingCell?.id === key && editingCell?.field === lang;
                    return (
                      <td key={lang} className="text-registry-cell">
                        {isEditing ? (
                          <input
                            autoFocus
                            className="text-registry-input"
                            defaultValue={entry[lang]}
                            onBlur={(e) => {
                              commitEdit(entry, lang, e.target.value);
                              setEditingCell(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { e.currentTarget.blur(); }
                              if (e.key === 'Escape') { setEditingCell(null); }
                            }}
                          />
                        ) : (
                          <span
                            className={`text-registry-value${entry[lang] ? '' : ' text-registry-empty'}`}
                            title={language === 'ru' ? 'Нажмите для редактирования' : 'Click to edit'}
                            onClick={() => setEditingCell({ id: key, field: lang })}
                          >
                            {entry[lang] || '—'}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td>
                    {empty ? (
                      <span className="text-registry-status status-empty">empty</span>
                    ) : missing ? (
                      <span className="text-registry-status status-partial">partial</span>
                    ) : (
                      <span className="text-registry-status status-ok">✓</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-registry-empty-row">
                  {language === 'ru' ? 'Нет строк' : 'No entries found'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
