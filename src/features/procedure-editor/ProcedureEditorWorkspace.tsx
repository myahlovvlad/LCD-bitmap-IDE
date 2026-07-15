import type React from 'react';
import { useState, useMemo } from 'react';
import {
  Plus, Search, Trash2, ChevronUp, ChevronDown, HelpCircle, Terminal
} from 'lucide-react';
import { useProjectStore } from '../../renderer/store/projectStore';
import { UI_TEXT } from '../../renderer/config/i18n';
import type { BackendProcedure, RuntimeAction, RuntimeActionType, CliCommandDefinition } from '../../domain/procedure';
import type { ValueExpression } from '../../domain/tag';
import { TutorialOverlay } from '../tutorial/TutorialOverlay';

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`;
}

const STEP_TYPES: RuntimeActionType[] = ['cli', 'delay', 'setTag', 'guard', 'audit'];

function defaultStep(type: RuntimeActionType): RuntimeAction {
  switch (type) {
    case 'cli': return { type: 'cli', cliCommandId: '' };
    case 'delay': return { type: 'delay', delayMs: 200 };
    case 'setTag': return { type: 'setTag', tagId: '', value: { kind: 'literal', value: '' } };
    case 'guard': return { type: 'guard', value: { kind: 'literal', value: true } };
    case 'audit': return { type: 'audit', message: { en: '', ru: '', zh: '' } };
  }
}

export function ProcedureEditorWorkspace(): React.ReactElement {
  const { project, language, upsertHmiProcedure, deleteHmiProcedure } = useProjectStore();
  const labels = UI_TEXT[language];

  const procedures = useMemo(() => project?.procedures ?? {}, [project]);
  const cliCatalog = useMemo(() => project?.cliCatalog ?? {}, [project]);
  const fsmStates = useMemo(() => project?.fsm.states ?? {}, [project]);

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BackendProcedure | null>(null);
  const [selectedStepIdx, setSelectedStepIdx] = useState<number | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);

  const procedureList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return Object.values(procedures).filter((p) =>
      !q || p.id.toLowerCase().includes(q) || p.name.en?.toLowerCase().includes(q) || p.name.ru?.toLowerCase().includes(q)
    );
  }, [procedures, search]);

  const selectProcedure = (id: string): void => {
    setSelectedId(id);
    setDraft({ ...procedures[id], steps: [...procedures[id].steps] });
    setSelectedStepIdx(null);
  };

  const addProcedure = (): void => {
    const id = generateId('proc');
    const proc: BackendProcedure = {
      id,
      name: { en: 'New procedure', ru: 'Новая процедура', zh: '新流程' },
      services: [],
      steps: []
    };
    upsertHmiProcedure(proc);
    setSelectedId(id);
    setDraft(proc);
    setSelectedStepIdx(null);
  };

  const removeProcedure = (id: string): void => {
    deleteHmiProcedure(id);
    if (selectedId === id) {
      setSelectedId(null);
      setDraft(null);
      setSelectedStepIdx(null);
    }
  };

  const saveDraft = (): void => {
    if (!draft) return;
    upsertHmiProcedure(draft);
  };

  const updateDraft = (patch: Partial<BackendProcedure>): void => {
    if (!draft) return;
    setDraft({ ...draft, ...patch });
  };

  const setDraftName = (lang: 'en' | 'ru' | 'zh', value: string): void => {
    if (!draft) return;
    setDraft({ ...draft, name: { ...draft.name, [lang]: value } });
  };

  const addStep = (type: RuntimeActionType): void => {
    if (!draft) return;
    const steps = [...draft.steps, defaultStep(type)];
    setDraft({ ...draft, steps });
    setSelectedStepIdx(steps.length - 1);
  };

  const removeStep = (idx: number): void => {
    if (!draft) return;
    const steps = draft.steps.filter((_, i) => i !== idx);
    setDraft({ ...draft, steps });
    setSelectedStepIdx(selectedStepIdx !== null && selectedStepIdx >= steps.length ? steps.length - 1 : selectedStepIdx);
  };

  const moveStep = (idx: number, direction: 'up' | 'down'): void => {
    if (!draft) return;
    const steps = [...draft.steps];
    const target = direction === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= steps.length) return;
    [steps[idx], steps[target]] = [steps[target], steps[idx]];
    setDraft({ ...draft, steps });
    setSelectedStepIdx(target);
  };

  const updateStep = (idx: number, patch: Partial<RuntimeAction>): void => {
    if (!draft) return;
    const steps = draft.steps.map((s, i) => i === idx ? { ...s, ...patch } : s);
    setDraft({ ...draft, steps });
  };

  const selectedStep = draft && selectedStepIdx !== null ? draft.steps[selectedStepIdx] : null;

  return (
    <div className="workspace-root" data-workspace="procedures">
      <aside className="workspace-sidebar">
        <div className="workspace-toolbar">
          <span className="sidebar-section-title">{labels.procedureLibrary}</span>
          <button type="button" title={labels.addProcedure} onClick={addProcedure}><Plus size={14} /></button>
        </div>
        <div className="workspace-toolbar sidebar-search-row">
          <label className="sidebar-search">
            <Search size={14} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={labels.searchProcedures}
            />
          </label>
        </div>
        <div className="entity-list">
          {procedureList.length === 0
            ? <p className="entity-list-empty">{labels.noProcedures}</p>
            : procedureList.map((proc) => (
              <div
                key={proc.id}
                className={`entity-card${selectedId === proc.id ? ' active' : ''}`}
                onClick={() => selectProcedure(proc.id)}
              >
                <span className="entity-card-label">{proc.name[language] || proc.name.en || proc.id}</span>
                <span className="entity-card-meta">{proc.steps.length} {labels.procedureSteps.toLowerCase()}</span>
                <button
                  type="button"
                  className="entity-card-delete"
                  title={labels.deleteProcedure}
                  onClick={(e) => { e.stopPropagation(); removeProcedure(proc.id); }}
                ><Trash2 size={12} /></button>
              </div>
            ))
          }
        </div>
      </aside>

      <div className="workspace-splitter" />

      <section className="workspace-canvas-column hmi-editor-main">
        <div className="workspace-section-header">
          <span>{labels.procedureEditor}</span>
          <button type="button" className="hmi-help-button" title={labels.showHelp} onClick={() => setShowTutorial(true)}>
            <HelpCircle size={15} />
          </button>
        </div>

        {draft ? (
          <div className="procedure-editor-layout">
            <div className="procedure-meta-panel">
              <div className="hmi-form-group">
                <div className="hmi-form-row">
                  <label className="hmi-form-label">{labels.procedureIdLabel}</label>
                  <input className="hmi-form-input" value={draft.id} readOnly />
                </div>
                <div className="hmi-form-row">
                  <label className="hmi-form-label">{labels.tagNameEn}</label>
                  <input className="hmi-form-input" value={draft.name.en ?? ''} onChange={(e) => setDraftName('en', e.target.value)} />
                </div>
                <div className="hmi-form-row">
                  <label className="hmi-form-label">{labels.tagNameRu}</label>
                  <input className="hmi-form-input" value={draft.name.ru ?? ''} onChange={(e) => setDraftName('ru', e.target.value)} />
                </div>
                <div className="hmi-form-row">
                  <label className="hmi-form-label">{labels.tagNameZh}</label>
                  <input className="hmi-form-input" value={draft.name.zh ?? ''} onChange={(e) => setDraftName('zh', e.target.value)} />
                </div>
                <div className="hmi-form-row">
                  <label className="hmi-form-label">{labels.failureTargetState}</label>
                  <select
                    className="hmi-form-select"
                    value={draft.failureTargetStateId ?? ''}
                    onChange={(e) => updateDraft({ failureTargetStateId: e.target.value || null })}
                  >
                    <option value="">{labels.none}</option>
                    {Object.values(fsmStates).map((s) => (
                      <option key={s.id} value={s.id}>{s.title || s.id}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="procedure-steps-header">
                <span>{labels.procedureSteps}</span>
                <div className="procedure-add-step">
                  {STEP_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      className="step-add-btn"
                      title={`${labels.addStep}: ${type}`}
                      onClick={() => addStep(type)}
                    >
                      + {type}
                    </button>
                  ))}
                </div>
              </div>

              {draft.steps.length === 0
                ? <p className="entity-list-empty">{labels.noSteps}</p>
                : (
                  <ol className="step-list">
                    {draft.steps.map((step, idx) => (
                      <li
                        key={idx}
                        className={`step-item${selectedStepIdx === idx ? ' active' : ''}`}
                        onClick={() => setSelectedStepIdx(idx)}
                      >
                        <span className="step-index">{idx + 1}</span>
                        <span className="step-type-badge step-type-{step.type}">{step.type}</span>
                        <span className="step-summary">{summarizeStep(step, cliCatalog, language)}</span>
                        <div className="step-controls">
                          <button type="button" onClick={(e) => { e.stopPropagation(); moveStep(idx, 'up'); }} disabled={idx === 0} title={labels.moveUp}>
                            <ChevronUp size={11} />
                          </button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); moveStep(idx, 'down'); }} disabled={idx === draft.steps.length - 1} title={labels.moveDown}>
                            <ChevronDown size={11} />
                          </button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); removeStep(idx); }} title={labels.removeStep}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ol>
                )
              }
            </div>

            <div className="procedure-step-editor">
              {selectedStep !== null && selectedStepIdx !== null ? (
                <StepEditor
                  step={selectedStep}
                  stepIdx={selectedStepIdx}
                  labels={labels}
                  language={language}
                  cliCatalog={cliCatalog}
                  onChange={(patch) => updateStep(selectedStepIdx, patch)}
                />
              ) : (
                <div className="hmi-empty-state">{labels.noProcedureSelected}</div>
              )}
            </div>

            <div className="hmi-form-actions">
              <button type="button" className="hmi-btn-primary" onClick={saveDraft}>{labels.save}</button>
            </div>
          </div>
        ) : (
          <div className="hmi-empty-state">{labels.noProcedureSelected}</div>
        )}
      </section>

      <div className="workspace-splitter" />

      <aside className="workspace-inspector">
        <div className="workspace-section-header">{labels.procedureLibrary}</div>
        <div className="inspector-card">
          <p className="inspector-stat">
            <span>{labels.procedureLibrary}</span>
            <strong>{Object.keys(procedures).length}</strong>
          </p>
          <p className="inspector-stat">
            <span><Terminal size={12} /> CLI</span>
            <strong>{Object.keys(cliCatalog).length}</strong>
          </p>
        </div>
        {draft ? (
          <div className="inspector-card">
            <div className="workspace-section-header">{labels.procedureSteps}</div>
            {STEP_TYPES.map((type) => {
              const count = draft.steps.filter((s) => s.type === type).length;
              return count > 0 ? (
                <p key={type} className="inspector-stat">
                  <span>{type}</span><strong>{count}</strong>
                </p>
              ) : null;
            })}
          </div>
        ) : null}
        <div className="inspector-card">
          <div className="workspace-section-header">CLI catalog</div>
          {Object.values(cliCatalog).slice(0, 8).map((cmd) => (
            <p key={cmd.id} className="inspector-detail"><code>{cmd.command}</code></p>
          ))}
          {Object.keys(cliCatalog).length > 8
            ? <p className="inspector-detail-dim">+{Object.keys(cliCatalog).length - 8} more</p>
            : null
          }
        </div>
      </aside>

      {showTutorial ? (
        <TutorialOverlay workspace="procedures" language={language} onClose={() => setShowTutorial(false)} />
      ) : null}
    </div>
  );
}

function summarizeStep(step: RuntimeAction, catalog: Record<string, CliCommandDefinition>, language: string): string {
  switch (step.type) {
    case 'cli': {
      const cmd = step.cliCommandId ? catalog[step.cliCommandId]?.command ?? step.cliCommandId : '—';
      return cmd;
    }
    case 'delay': return `${step.delayMs ?? 0} ms`;
    case 'setTag': return `${step.tagId ?? '?'} = ${expressionSummary(step.value)}`;
    case 'guard': return expressionSummary(step.value);
    case 'audit': return step.message?.[language as 'en' | 'ru' | 'zh'] ?? step.message?.en ?? '—';
    default: return '';
  }
}

function expressionSummary(expr: ValueExpression | undefined): string {
  if (!expr) return '—';
  if (expr.kind === 'literal') return String(expr.value);
  if (expr.kind === 'tag') return `@${expr.tagId}`;
  return expr.expression;
}

function StepEditor({
  step,
  stepIdx,
  labels,
  language,
  cliCatalog,
  onChange
}: {
  step: RuntimeAction;
  stepIdx: number;
  labels: (typeof UI_TEXT)[keyof typeof UI_TEXT];
  language: string;
  cliCatalog: Record<string, CliCommandDefinition>;
  onChange: (patch: Partial<RuntimeAction>) => void;
}): React.ReactElement {
  return (
    <div className="hmi-form step-editor-form">
      <div className="workspace-section-header">{labels.stepType}: {step.type}</div>

      {step.type === 'cli' ? (
        <>
          <div className="hmi-form-row">
            <label className="hmi-form-label">{labels.cliCommandId}</label>
            <select
              className="hmi-form-select"
              value={step.cliCommandId ?? ''}
              onChange={(e) => onChange({ cliCommandId: e.target.value })}
            >
              <option value="">{labels.none}</option>
              {Object.values(cliCatalog).map((cmd) => (
                <option key={cmd.id} value={cmd.id}>{cmd.command}</option>
              ))}
            </select>
          </div>
          {step.cliCommandId && cliCatalog[step.cliCommandId] ? (
            <p className="inspector-detail">
              <code>{cliCatalog[step.cliCommandId].command}</code>
              {cliCatalog[step.cliCommandId].expectedDurationMs
                ? ` (~${cliCatalog[step.cliCommandId].expectedDurationMs} ms)`
                : null
              }
            </p>
          ) : null}
        </>
      ) : null}

      {step.type === 'delay' ? (
        <div className="hmi-form-row">
          <label className="hmi-form-label">{labels.delayMs}</label>
          <input
            className="hmi-form-input"
            type="number"
            min={0}
            step={50}
            value={step.delayMs ?? 0}
            onChange={(e) => onChange({ delayMs: Number(e.target.value) })}
          />
        </div>
      ) : null}

      {step.type === 'setTag' ? (
        <>
          <div className="hmi-form-row">
            <label className="hmi-form-label">{labels.stepTagId}</label>
            <input
              className="hmi-form-input"
              value={step.tagId ?? ''}
              onChange={(e) => onChange({ tagId: e.target.value })}
              placeholder="tag-id"
            />
          </div>
          <div className="hmi-form-row">
            <label className="hmi-form-label">{labels.stepValue}</label>
            <ExpressionInput
              value={step.value}
              onChange={(value) => onChange({ value })}
              labels={labels}
            />
          </div>
        </>
      ) : null}

      {step.type === 'guard' ? (
        <div className="hmi-form-row">
          <label className="hmi-form-label">{labels.guardExpression}</label>
          <ExpressionInput
            value={step.value}
            onChange={(value) => onChange({ value })}
            labels={labels}
          />
        </div>
      ) : null}

      {step.type === 'audit' ? (
        <>
          <div className="hmi-form-row">
            <label className="hmi-form-label">{labels.tagNameEn}</label>
            <input
              className="hmi-form-input"
              value={step.message?.en ?? ''}
              onChange={(e) => onChange({ message: { ...(step.message ?? { ru: '', zh: '' }), en: e.target.value } })}
            />
          </div>
          <div className="hmi-form-row">
            <label className="hmi-form-label">{labels.tagNameRu}</label>
            <input
              className="hmi-form-input"
              value={step.message?.ru ?? ''}
              onChange={(e) => onChange({ message: { ...(step.message ?? { en: '', zh: '' }), ru: e.target.value } })}
            />
          </div>
          <div className="hmi-form-row">
            <label className="hmi-form-label">{labels.tagNameZh}</label>
            <input
              className="hmi-form-input"
              value={step.message?.zh ?? ''}
              onChange={(e) => onChange({ message: { ...(step.message ?? { en: '', ru: '' }), zh: e.target.value } })}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function ExpressionInput({
  value,
  onChange,
  labels
}: {
  value: ValueExpression | undefined;
  onChange: (expr: ValueExpression) => void;
  labels: (typeof UI_TEXT)[keyof typeof UI_TEXT];
}): React.ReactElement {
  const kind = value?.kind ?? 'literal';

  return (
    <div className="expression-input">
      <select
        className="hmi-form-select expression-kind"
        value={kind}
        onChange={(e) => {
          const k = e.target.value as ValueExpression['kind'];
          if (k === 'literal') onChange({ kind: 'literal', value: '' });
          else if (k === 'tag') onChange({ kind: 'tag', tagId: '' });
          else onChange({ kind: 'formula', expression: '', deps: [] });
        }}
      >
        <option value="literal">literal</option>
        <option value="tag">tag</option>
        <option value="formula">formula</option>
      </select>
      {kind === 'literal' && (
        <input
          className="hmi-form-input"
          value={value?.kind === 'literal' ? String(value.value) : ''}
          onChange={(e) => {
            const raw = e.target.value;
            const num = Number(raw);
            const v = raw === 'true' ? true : raw === 'false' ? false : !isNaN(num) && raw !== '' ? num : raw;
            onChange({ kind: 'literal', value: v });
          }}
          placeholder="value"
        />
      )}
      {kind === 'tag' && (
        <input
          className="hmi-form-input"
          value={value?.kind === 'tag' ? value.tagId : ''}
          onChange={(e) => onChange({ kind: 'tag', tagId: e.target.value })}
          placeholder="tag-id"
        />
      )}
      {kind === 'formula' && (
        <input
          className="hmi-form-input"
          value={value?.kind === 'formula' ? value.expression : ''}
          onChange={(e) => onChange({ kind: 'formula', expression: e.target.value, deps: [] })}
          placeholder="Math.log10(x)"
        />
      )}
    </div>
  );
}
