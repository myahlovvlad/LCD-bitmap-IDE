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
import { useMemo, useRef, useState } from 'react';
import { Download, HelpCircle, Search, Upload, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useProjectStore } from '../../renderer/store/projectStore';
import { UI_TEXT } from '../../renderer/config/i18n';
import type { TextCanvasObject } from '../../renderer/types/domain';
import { TutorialOverlay } from '../tutorial/TutorialOverlay';

interface TextEntry {
  screenId: string;
  screenName: string;
  objectId: string;
  ru: string;
  en: string;
  zh: string;
  subsystem: string;
  globalTextKey?: string;
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
        globalTextKey: obj.globalTextKey,
      });
    }
  }
  return entries;
}

function normalizeTextKey(text: string): string {
  return text.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function cell(row: Record<string, unknown>, ...names: string[]): string {
  const index = new Map(Object.keys(row).map((key) => [key.toLowerCase().replace(/[ _-]/g, ''), key]));
  for (const name of names) {
    const key = index.get(name.toLowerCase().replace(/[ _-]/g, ''));
    if (key && row[key] !== undefined && row[key] !== null) return String(row[key]);
  }
  return '';
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
  const [showTutorial, setShowTutorial] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

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
    const peerKey = entry.globalTextKey;
    const peers = allEntries.filter((candidate) => peerKey
      ? candidate.globalTextKey === peerKey
      : candidate.screenId === entry.screenId && candidate.objectId === entry.objectId);
    for (const peer of peers) {
      const screen = project.screens[peer.screenId];
      const obj = screen?.objects.find((object) => object.id === peer.objectId);
      if (!obj || obj.type !== 'text') continue;
      updateCanvasObject(peer.screenId, { ...obj, text: { ...obj.text, [field]: value } });
    }
  };

  const promoteRepeatedText = (): void => {
    const groups = new Map<string, TextEntry[]>();
    for (const entry of allEntries) {
      const key = normalizeTextKey(entry.ru);
      if (!key) continue;
      const group = groups.get(key) ?? [];
      group.push(entry);
      groups.set(key, group);
    }
    for (const [key, entries] of groups) {
      if (entries.length < 2) continue;
      for (const entry of entries) {
        const screen = project.screens[entry.screenId];
        const obj = screen?.objects.find((object) => object.id === entry.objectId);
        if (obj?.type === 'text' && obj.globalTextKey !== `global:${key}`) {
          updateCanvasObject(entry.screenId, { ...obj, globalTextKey: `global:${key}` });
        }
      }
    }
  };

  const importRegistry = async (file: File): Promise<void> => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    let rows: Record<string, unknown>[];
    if (extension === 'json') {
      rows = JSON.parse(await file.text()) as Record<string, unknown>[];
    } else {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = sheet ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' }) : [];
    }
    for (const row of rows) {
      const screenId = cell(row, 'screen_id', 'screen id', 'screenid');
      const objectId = cell(row, 'object_id', 'object id', 'objectid');
      const screen = project.screens[screenId];
      const object = screen?.objects.find((candidate) => candidate.id === objectId);
      if (!object || object.type !== 'text') continue;
      updateCanvasObject(screenId, {
        ...object,
        text: {
          ...object.text,
          ru: cell(row, 'ru') || object.text.ru,
          en: cell(row, 'en') || object.text.en,
          zh: cell(row, 'zh') || object.text.zh,
        }
      });
    }
  };

  const cellKey = (e: TextEntry, f: string): string => `${e.screenId}:${e.objectId}:${f}`;

  return (
    <section className="workspace-root text-registry-workspace" aria-label={labels.textRegistryWorkspace}>
      <header className="workspace-section-header text-registry-header">
        <h2>
          {labels.textRegistryWorkspace}
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
          <button type="button" onClick={() => importRef.current?.click()} title="Импорт CSV, JSON или XLSX">
            <Upload size={14} /> Импорт
          </button>
          <button type="button" onClick={promoteRepeatedText} title="Сделать повторяющиеся русские строки глобальными">
            <RefreshCw size={14} /> Синхронизировать повторы
          </button>
          <button type="button" className="hmi-help-button" onClick={() => setShowTutorial(true)} title={language === 'ru' ? 'Обучение' : 'Training'}><HelpCircle size={15} /></button>
          <input
            ref={importRef}
            type="file"
            hidden
            accept=".csv,.json,.xlsx"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importRegistry(file);
              event.currentTarget.value = '';
            }}
          />
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
                            title={labels.clickToEdit}
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
                      <span className="text-registry-status status-empty">{labels.statusEmpty}</span>
                    ) : missing ? (
                      <span className="text-registry-status status-partial">{labels.statusPartial}</span>
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
                  {labels.noEntriesFound}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {showTutorial ? <TutorialOverlay workspace="text-registry" language={language} onClose={() => setShowTutorial(false)} /> : null}
    </section>
  );
}
