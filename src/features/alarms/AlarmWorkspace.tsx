import type React from 'react';
import { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Copy,
  HelpCircle,
  Info,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Trash2,
  Zap
} from 'lucide-react';
import { useWorkspaceRouter } from '../../app/WorkspaceRouter';
import { useProjectStore } from '../../renderer/store/projectStore';
import { UI_TEXT } from '../../renderer/config/i18n';
import type { AlarmDefinition, AlarmSeverity } from '../../domain/alarm';
import type { LanguageCode } from '../../domain/localization';
import { TutorialOverlay } from '../tutorial/TutorialOverlay';

function newAlarm(): AlarmDefinition {
  const id = `alarm-${Date.now()}`;
  return {
    id,
    name: { en: 'New alarm', ru: 'Новая авария', zh: '新建报警' },
    severity: 'warning',
    condition: { kind: 'literal', value: false },
    message: { en: '', ru: '', zh: '' },
    autoAcknowledge: false
  };
}

const SEVERITY_ICONS: Record<AlarmSeverity, React.ReactElement> = {
  info: <Info size={14} />,
  warning: <AlertTriangle size={14} />,
  critical: <AlertCircle size={14} />
};

const SEVERITY_CLASS: Record<AlarmSeverity, string> = {
  info: 'alarm-info',
  warning: 'alarm-warning',
  critical: 'alarm-critical'
};

export function AlarmWorkspace(): React.ReactElement {
  const { project, language, upsertAlarm, deleteAlarm } = useProjectStore();
  const { navigate } = useWorkspaceRouter();
  const labels = UI_TEXT[language];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AlarmDefinition | null>(null);
  const [search, setSearch] = useState('');
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  if (!project) {
    return <section className="workspace-empty">{labels.noProjectLoaded}</section>;
  }

  const alarms = Object.values(project.alarms ?? {});
  const filtered = alarms.filter((a) =>
    a.id.toLowerCase().includes(search.toLowerCase()) ||
    a.name[language as LanguageCode]?.toLowerCase().includes(search.toLowerCase()) ||
    a.name.en.toLowerCase().includes(search.toLowerCase())
  );

  const selectAlarm = (id: string) => {
    setSelectedId(id);
    setDraft(structuredClone(project.alarms?.[id] ?? null));
  };

  const doDelete = (id: string) => {
    deleteAlarm(id);
    if (selectedId === id) { setSelectedId(null); setDraft(null); }
  };

  const handleNew = () => {
    const alarm = newAlarm();
    upsertAlarm(alarm);
    selectAlarm(alarm.id);
  };

  const handleSave = () => {
    if (draft) { upsertAlarm(draft); }
  };

  const handleDuplicate = (id: string) => {
    const src = project.alarms?.[id];
    if (!src) return;
    const copy: AlarmDefinition = { ...structuredClone(src), id: `${src.id}-copy-${Date.now()}` };
    upsertAlarm(copy);
    selectAlarm(copy.id);
  };

  return (
    <section
      className="workspace-root alarm-workspace"
      style={{
        gridTemplateColumns: `${leftCollapsed ? 46 : 280}px 6px 1fr`
      }}
    >
      {/* Left sidebar */}
      <aside className={`workspace-sidebar collapsible-sidebar${leftCollapsed ? ' collapsed' : ''}`}>
        <header className="workspace-section-header">
          {!leftCollapsed && <h2>{labels.alarmsWorkspace}</h2>}
          <div className="sidebar-header-actions">
            {!leftCollapsed && (
              <button type="button" onClick={handleNew} title={labels.alarmNew}>
                <Plus size={16} />
              </button>
            )}
            <button
              type="button"
              className="sidebar-collapse-button"
              onClick={() => setLeftCollapsed((v) => !v)}
              aria-label="Toggle sidebar"
            >
              {leftCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          </div>
        </header>

        {!leftCollapsed && (
          <>
            <div className="sidebar-search sidebar-content">
              <Search size={14} />
              <input
                placeholder={labels.searchPlaceholder ?? 'Search…'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="sidebar-content entity-list">
              {filtered.length === 0 && (
                <p className="runtime-empty-hint">{labels.noTags ?? 'No alarms defined.'}</p>
              )}
              {filtered.map((alarm) => (
                <article
                  key={alarm.id}
                  className={`entity-card${selectedId === alarm.id ? ' active' : ''}`}
                >
                  <button
                    type="button"
                    className="entity-row"
                    onClick={() => selectAlarm(alarm.id)}
                  >
                    <span className={`alarm-severity-icon ${SEVERITY_CLASS[alarm.severity]}`}>
                      {SEVERITY_ICONS[alarm.severity]}
                    </span>
                    <div>
                      <strong>{alarm.name[language as LanguageCode] ?? alarm.name.en}</strong>
                      <small>{alarm.id}</small>
                    </div>
                  </button>
                  <div>
                    <button type="button" title="Duplicate" onClick={() => handleDuplicate(alarm.id)}>
                      <Copy size={14} />
                    </button>
                    <button type="button" title="Delete" onClick={() => doDelete(alarm.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </aside>

      <div className="workspace-splitter" />

      {/* Main form */}
      <main className="workspace-canvas-column">
        <header className="workspace-toolbar">
          <span>{labels.alarmsWorkspace}</span>
          <button type="button" onClick={handleNew}>
            <Plus size={15} />{labels.alarmNew}
          </button>
          <button type="button" className="hmi-help-button" title={labels.showHelp} onClick={() => setShowTutorial(true)}>
            <HelpCircle size={15} />
          </button>
        </header>

        {!draft && alarms.length === 0 ? (
          <div className="workspace-empty alarm-empty-tutorial">
            <AlertCircle size={32} />
            <h3>{labels.alarmEmptyTitle}</h3>
            <p>{labels.alarmEmptyBody}</p>
            <ol className="alarm-empty-steps">
              <li>{labels.alarmEmptyStep1}</li>
              <li>{labels.alarmEmptyStep2}</li>
              <li>{labels.alarmEmptyStep3}</li>
            </ol>
            <div className="alarm-empty-actions">
              <button type="button" onClick={() => navigate({ mode: 'tags' })}>
                {labels.alarmCreateTagCta}<ArrowRight size={14} />
              </button>
              <button type="button" className="hmi-btn-primary" onClick={handleNew}>
                <Plus size={15} />{labels.alarmNew}
              </button>
            </div>
          </div>
        ) : !draft ? (
          <div className="workspace-empty">
            <AlertCircle size={32} />
            <p>{labels.alarmNew}</p>
            <button type="button" onClick={handleNew}><Plus size={15} />{labels.alarmNew}</button>
          </div>
        ) : (
          <div className="hmi-editor-layout">
            <section className="inspector-card sidebar-content hmi-form">
              <h3>{draft.name[language as LanguageCode] ?? draft.name.en}</h3>

              {/* ID */}
              <div className="hmi-form-row">
                <label className="hmi-form-label">{labels.alarmId}</label>
                <input
                  className="hmi-form-input"
                  value={draft.id}
                  onChange={(e) => setDraft({ ...draft, id: e.target.value })}
                />
              </div>

              {/* Name per language */}
              <div className="hmi-form-group">
                <span className="hmi-form-label">{labels.alarmName}</span>
                {(['en', 'ru', 'zh'] as LanguageCode[]).map((lang) => (
                  <div key={lang} className="hmi-form-row">
                    <label className="hmi-form-label hmi-lang-tag">{lang.toUpperCase()}</label>
                    <input
                      className="hmi-form-input"
                      value={draft.name[lang] ?? ''}
                      placeholder={`Name (${lang})`}
                      onChange={(e) => setDraft({ ...draft, name: { ...draft.name, [lang]: e.target.value } })}
                    />
                  </div>
                ))}
              </div>

              {/* Severity */}
              <div className="hmi-form-row">
                <label className="hmi-form-label">{labels.alarmSeverity}</label>
                <select
                  className="hmi-form-select"
                  value={draft.severity}
                  onChange={(e) => setDraft({ ...draft, severity: e.target.value as AlarmSeverity })}
                >
                  <option value="info">{labels.alarmSeverityInfo}</option>
                  <option value="warning">{labels.alarmSeverityWarning}</option>
                  <option value="critical">{labels.alarmSeverityCritical}</option>
                </select>
              </div>

              {/* Condition (simplified: tag expression string) */}
              <div className="hmi-form-row">
                <label className="hmi-form-label">{labels.alarmCondition}</label>
                <input
                  className="hmi-form-input hmi-form-input--mono"
                  value={draft.condition.kind === 'tag' ? `@${draft.condition.tagId}` : String(draft.condition.kind === 'literal' ? draft.condition.value : '')}
                  placeholder="@tag_id or true/false"
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    if (raw.startsWith('@')) {
                      setDraft({ ...draft, condition: { kind: 'tag', tagId: raw.slice(1) } });
                    } else {
                      setDraft({ ...draft, condition: { kind: 'literal', value: raw === 'true' } });
                    }
                  }}
                />
              </div>

              {/* Message per language */}
              <div className="hmi-form-group">
                <span className="hmi-form-label">{labels.alarmMessage}</span>
                {(['en', 'ru', 'zh'] as LanguageCode[]).map((lang) => (
                  <div key={lang} className="hmi-form-row">
                    <label className="hmi-form-label hmi-lang-tag">{lang.toUpperCase()}</label>
                    <input
                      className="hmi-form-input"
                      value={draft.message[lang] ?? ''}
                      placeholder={`Message (${lang})`}
                      onChange={(e) => setDraft({ ...draft, message: { ...draft.message, [lang]: e.target.value } })}
                    />
                  </div>
                ))}
              </div>

              {/* Auto-acknowledge */}
              <div className="hmi-form-row hmi-form-row--check">
                <label className="hmi-form-label">{labels.alarmAutoAck}</label>
                <label className="hmi-toggle">
                  <input
                    type="checkbox"
                    checked={draft.autoAcknowledge ?? false}
                    onChange={(e) => setDraft({ ...draft, autoAcknowledge: e.target.checked })}
                  />
                  <Zap size={13} />
                </label>
              </div>

              <div className="hmi-form-actions">
                <button type="button" className="hmi-btn-primary" onClick={handleSave}>
                  {labels.save}
                </button>
                <button type="button" className="hmi-btn-danger" onClick={() => selectedId && deleteAlarm(selectedId)}>
                  <Trash2 size={14} />{labels.delete}
                </button>
              </div>
            </section>

            {/* Active alarms preview */}
            <section className="inspector-card sidebar-content">
              <h3>Active alarms ({alarms.filter((a) => a.severity === 'critical').length} critical)</h3>
              <div className="alarm-severity-summary">
                {(['critical', 'warning', 'info'] as AlarmSeverity[]).map((sev) => {
                  const count = alarms.filter((a) => a.severity === sev).length;
                  return (
                    <div key={sev} className={`alarm-severity-badge ${SEVERITY_CLASS[sev]}`}>
                      {SEVERITY_ICONS[sev]} {count} {sev}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </main>
      {showTutorial ? (
        <TutorialOverlay workspace="alarms" language={language} onClose={() => setShowTutorial(false)} />
      ) : null}
    </section>
  );
}
