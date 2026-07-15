import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { OPERATION_MANUAL_BY_LANGUAGE, type ManualBlock } from '../config/operationManual';
import { UI_TEXT, type UiText } from '../config/i18n';
import type { LanguageCode } from '../types/domain';

interface TourStep {
  selector: string;
  title: string;
  body: string;
}

const TOUR_STEPS: Record<LanguageCode, TourStep[]> = {
  en: [
    { selector: '.project-header', title: 'Project actions', body: 'Open, save, export and undo project-level changes here.' },
    { selector: '.workspace-navigation', title: 'Workspaces', body: 'Switch between FSM, LCD, physical panel and runtime preview.' },
    { selector: '.workspace-root', title: 'Active workspace', body: 'Each workspace exposes only its own tools and references.' },
    { selector: '.statusbar', title: 'Project status', body: 'Review project dimensions, entity counts and validation status.' }
  ],
  ru: [
    { selector: '.project-header', title: 'Операции проекта', body: 'Здесь находятся открытие, сохранение, экспорт и история изменений.' },
    { selector: '.workspace-navigation', title: 'Рабочие области', body: 'Переключайтесь между FSM, LCD, физической панелью и runtime-просмотром.' },
    { selector: '.workspace-root', title: 'Активная область', body: 'Каждая область показывает только свои инструменты и ссылки.' },
    { selector: '.statusbar', title: 'Статус проекта', body: 'Размеры проекта, количество сущностей и состояние валидации.' }
  ],
  zh: [
    { selector: '.project-header', title: '项目操作', body: '在此打开、保存、导出项目并撤销更改。' },
    { selector: '.workspace-navigation', title: '工作区', body: '在 FSM、LCD、物理面板和运行时预览之间切换。' },
    { selector: '.workspace-root', title: '活动工作区', body: '每个工作区只显示自己的工具和引用。' },
    { selector: '.statusbar', title: '项目状态', body: '查看项目尺寸、实体数量和验证状态。' }
  ]
};

export function OperationManualDialog({
  labels,
  language,
  onClose
}: {
  labels: UiText;
  language: LanguageCode;
  onClose: () => void;
}): React.ReactElement {
  const [manualLanguage, setManualLanguage] = useState<LanguageCode>(language);
  const manual = OPERATION_MANUAL_BY_LANGUAGE[manualLanguage];
  const manualLabels = UI_TEXT[manualLanguage];
  const [activeId, setActiveId] = useState(manual[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [tourIndex, setTourIndex] = useState<number | null>(null);
  const filteredManual = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(manualLanguage === 'zh' ? 'zh-CN' : manualLanguage);
    return normalized
      ? manual.filter((section) => JSON.stringify(section).toLocaleLowerCase().includes(normalized))
      : manual;
  }, [manualLanguage, manual, query]);
  const active = filteredManual.find((section) => section.id === activeId) ?? filteredManual[0];
  const learningTasks = useMemo(() => manual.flatMap((section) =>
    section.blocks
      .filter((block): block is Extract<ManualBlock, { kind: 'task' }> => block.kind === 'task')
      .map((block, index) => ({ id: `${section.id}-${index}`, title: block.task }))
  ), [manual]);

  return (
    <>
      <div className="manual-overlay" role="dialog" aria-modal="true" aria-label={manualLabels.manualTitle}>
        <section className="manual-dialog">
          <header className="manual-header">
            <div><h2>{manualLabels.manualTitle}</h2><p>{manualLabels.manualSubtitle}</p></div>
            <button type="button" onClick={onClose} aria-label="Close manual"><X size={18} /></button>
          </header>
          <div className="manual-tools">
            <label className="manual-search">
              <Search size={16} />
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={manualLabels.searchManual} />
            </label>
            <select value={manualLanguage} onChange={(event) => setManualLanguage(event.target.value as LanguageCode)} aria-label="Manual language">
              <option value="ru">RU</option>
              <option value="zh">CH</option>
              <option value="en">EN</option>
            </select>
            <button type="button" className="manual-tour-button" onClick={() => exportManualHtml(manualLanguage)}>{manualLabels.exportHtml}</button>
            <button type="button" className="manual-tour-button" onClick={() => void exportManualPdf(manualLanguage)}>{manualLabels.exportPdf}</button>
            <button type="button" className="manual-tour-button" onClick={() => setTourIndex(0)}>{manualLabels.startGuidedTour}</button>
          </div>
          <div className="manual-layout">
            <nav className="manual-toc" aria-label={manualLabels.manualContents}>
              {filteredManual.map((section) => (
                <button key={section.id} type="button" className={section.id === active?.id ? 'manual-toc-item is-active' : 'manual-toc-item'} onClick={() => setActiveId(section.id)}>
                  {section.title}
                </button>
              ))}
              <section className="manual-learning">
                <strong>{manualLabels.learningCases}</strong>
                <small>{completedTasks.length}/{learningTasks.length}</small>
                {learningTasks.map((task) => (
                  <label key={task.id}>
                    <input
                      type="checkbox"
                      checked={completedTasks.includes(task.id)}
                      onChange={(event) => setCompletedTasks((items) =>
                        event.target.checked ? [...items, task.id] : items.filter((id) => id !== task.id)
                      )}
                    />
                    <span>{task.title}</span>
                  </label>
                ))}
              </section>
            </nav>
            <div className="manual-body">
              {active ? (
                <article className="manual-section">
                  <h3>{active.title}</h3>
                  {active.summary ? <p className="manual-summary">{active.summary}</p> : null}
                  {active.blocks.map((block, index) => <ManualBlockView key={index} block={block} />)}
                </article>
              ) : <p className="manual-empty">No matching section.</p>}
            </div>
          </div>
        </section>
      </div>
      {tourIndex !== null ? (
        <GuidedTour
          steps={TOUR_STEPS[manualLanguage]}
          labels={manualLabels}
          index={tourIndex}
          onChange={setTourIndex}
          onClose={() => setTourIndex(null)}
        />
      ) : null}
    </>
  );
}

function ManualBlockView({ block }: { block: ManualBlock }): React.ReactElement {
  if (block.kind === 'lead') return <p className="manual-lead">{block.text}</p>;
  if (block.kind === 'text') return <p>{block.text}</p>;
  if (block.kind === 'note') return <p className="manual-note">{block.text}</p>;
  if (block.kind === 'steps') return <ol className="manual-steps">{block.items.map((item) => <li key={item}>{item}</li>)}</ol>;
  if (block.kind === 'task') return (
    <div className="manual-task">
      <p className="manual-task-goal">{block.task}</p>
      <p className="manual-task-principle">{block.principle}</p>
      <ol className="manual-steps">{block.steps.map((step) => <li key={step}>{step}</li>)}</ol>
    </div>
  );
  if (block.kind === 'diagram') return <figure className="manual-diagram"><pre>{block.art}</pre>{block.caption ? <figcaption>{block.caption}</figcaption> : null}</figure>;
  if (block.kind === 'table') return (
    <div className="manual-table-wrap">
      <table className="manual-table">
        <thead><tr>{block.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>{block.rows.map((row) => <tr key={row.join('|')}>{row.map((cell, index) => <td key={`${index}-${cell}`}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
  return <></>;
}

function exportManualHtml(language: LanguageCode): void {
  const html = buildManualHtml(language);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `lcd-bitmap-ide-manual-${language}.html`;
  link.click();
  URL.revokeObjectURL(url);
}

async function exportManualPdf(language: LanguageCode): Promise<void> {
  const html = buildManualHtml(language);
  const filename = `lcd-bitmap-ide-manual-${language}.pdf`;
  if (window.spectroDesigner?.manualExportPdf) {
    await window.spectroDesigner.manualExportPdf(html, filename);
    return;
  }
  exportManualHtml(language);
}

function buildManualHtml(language: LanguageCode): string {
  const manual = OPERATION_MANUAL_BY_LANGUAGE[language];
  const title = UI_TEXT[language].manualTitle;
  return `<!doctype html>
<html lang="${language === 'zh' ? 'zh-CN' : language}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: "PT Serif", Georgia, serif; font-size: 14pt; line-height: 1.6; color: #1a1a1a; max-width: 210mm; margin: 0 auto; padding: 18mm; }
    .manual-shell { display: grid; grid-template-columns: 54mm minmax(0, 1fr); gap: 12mm; }
    nav { position: sticky; top: 10mm; align-self: start; border-right: 1px solid #ccc; padding-right: 8mm; font-size: 10.5pt; }
    nav a { display: block; color: #1f3f77; text-decoration: none; margin: 0 0 5px; }
    h1 { font-size: 18pt; text-align: center; margin-bottom: 12mm; }
    h2 { font-size: 14pt; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    h3 { font-size: 12.5pt; margin-bottom: 4px; }
    section { break-inside: avoid; margin-bottom: 10mm; }
    pre { white-space: pre-wrap; background: #f3f4f6; padding: 12px; border: 1px solid #d1d5db; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0; }
    th, td { border: 1px solid #d1d5db; padding: 7px 9px; text-align: left; vertical-align: top; }
    th { background: #f0f0f0; }
    .note { border-left: 4px solid #f59e0b; padding-left: 10px; }
    figure { text-align: center; margin: 1.5rem 0; break-inside: avoid; }
    figcaption { font-size: 11pt; color: #555; margin-top: 6px; }
    .screenshot-placeholder { display: flex; align-items: center; justify-content: center; min-height: 190px; border: 2px dashed #94a3b8; border-radius: 8px; background: #111827; color: #cbd5e1; font-family: Arial, sans-serif; }
    code { background: #f5f5f5; padding: 2px 5px; border-radius: 3px; font-family: monospace; }
    kbd { background: #eee; border: 1px solid #bbb; border-radius: 3px; padding: 1px 5px; font-family: monospace; }
    @media print { body { padding: 12mm; } .manual-shell { display: block; } nav { position: static; border-right: 0; border-bottom: 1px solid #ccc; margin-bottom: 8mm; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="manual-shell">
    <nav aria-label="${escapeHtml(UI_TEXT[language].manualContents)}">
      <strong>${escapeHtml(UI_TEXT[language].manualContents)}</strong>
      ${manual.map((section, index) => `<a href="#section-${index + 1}">${index + 1}. ${escapeHtml(section.title)}</a>`).join('')}
    </nav>
    <main>
      ${manual.map((section, index) => `<section id="section-${index + 1}"><h2>${index + 1}. ${escapeHtml(section.title)}</h2>${section.summary ? `<p><em>${escapeHtml(section.summary)}</em></p>` : ''}${section.blocks.map((block, blockIndex) => blockToHtml(block, index + 1, blockIndex + 1)).join('')}${figurePlaceholder(section.title, index + 1)}</section>`).join('')}
    </main>
  </div>
</body>
</html>`;
}

function blockToHtml(block: ManualBlock, sectionNumber: number, blockNumber: number): string {
  if (block.kind === 'lead' || block.kind === 'text') return `<p>${escapeHtml(block.text)}</p>`;
  if (block.kind === 'note') return `<p class="note">${escapeHtml(block.text)}</p>`;
  if (block.kind === 'steps') return `<ol>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>`;
  if (block.kind === 'task') return `<article><h3>${sectionNumber}.${blockNumber}. ${escapeHtml(block.task)}</h3><p>${escapeHtml(block.principle)}</p><ol>${block.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>${figurePlaceholder(block.task, sectionNumber, blockNumber)}</article>`;
  if (block.kind === 'diagram') return `<figure><pre>${escapeHtml(block.art)}</pre>${block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : ''}</figure>`;
  if (block.kind === 'table') {
    return `<table><thead><tr>${block.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${block.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  return '';
}

function figurePlaceholder(title: string, sectionNumber: number, blockNumber = 0): string {
  const figureNumber = blockNumber ? `${sectionNumber}.${blockNumber}` : `${sectionNumber}`;
  return `<figure><div class="screenshot-placeholder">[Screenshot: ${escapeHtml(title)}]</div><figcaption>Fig. ${figureNumber} — ${escapeHtml(title)}</figcaption></figure>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function GuidedTour({
  steps,
  labels,
  index,
  onChange,
  onClose
}: {
  steps: TourStep[];
  labels: UiText;
  index: number;
  onChange: (index: number) => void;
  onClose: () => void;
}): React.ReactElement | null {
  const step = steps[index];
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!step) {
      onClose();
      return;
    }
    const target = document.querySelector<HTMLElement>(step.selector);
    if (!target) {
      setRect(null);
      return;
    }
    target.scrollIntoView({ block: 'center', inline: 'center' });
    const update = (): void => setRect(target.getBoundingClientRect());
    const timeout = window.setTimeout(update, 100);
    window.addEventListener('resize', update);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('resize', update);
    };
  }, [onClose, step]);
  if (!step) {
    return null;
  }
  return (
    <div className="guided-tour" role="dialog" aria-modal="true" aria-labelledby="guided-tour-title">
      {rect ? <div className="guided-tour-highlight" style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }} /> : null}
      <section className="guided-tour-card">
        <small>{index + 1}/{steps.length}</small>
        <h2 id="guided-tour-title">{step.title}</h2>
        <p>{step.body}</p>
        <div className="guided-tour-actions">
          <button type="button" onClick={onClose}>{labels.finish}</button>
          <button type="button" disabled={index === 0} onClick={() => onChange(index - 1)}>{labels.previous}</button>
          <button type="button" onClick={() => index === steps.length - 1 ? onClose() : onChange(index + 1)}>
            {index === steps.length - 1 ? labels.finish : labels.next}
          </button>
        </div>
      </section>
    </div>
  );
}
