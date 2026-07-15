import type React from 'react';
import { useState, useMemo } from 'react';
import { Plus, Search, Trash2, Tag, Database, HelpCircle } from 'lucide-react';
import { useProjectStore } from '../../renderer/store/projectStore';
import { UI_TEXT } from '../../renderer/config/i18n';
import type { HmiTag, DataSource, HmiTagDataType, DataSourceKind } from '../../domain/tag';
import { TutorialOverlay } from '../tutorial/TutorialOverlay';

type ActivePanel = 'tags' | 'sources';

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`;
}

const DATA_TYPES: HmiTagDataType[] = ['float', 'int', 'bool', 'string'];
const SOURCE_KINDS: DataSourceKind[] = ['cli', 'serial', 'simulation', 'formula'];

export function TagEditorWorkspace(): React.ReactElement {
  const { project, language, setHmiTags } = useProjectStore();
  const labels = UI_TEXT[language];

  const tags = useMemo(() => project?.tags ?? {}, [project]);
  const dataSources = useMemo(() => project?.dataSources ?? {}, [project]);

  const [activePanel, setActivePanel] = useState<ActivePanel>('tags');
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [tagSearch, setTagSearch] = useState('');
  const [showTutorial, setShowTutorial] = useState(false);

  // Local draft state for the selected tag
  const [draft, setDraft] = useState<HmiTag | null>(null);
  const [sourceDraft, setSourceDraft] = useState<DataSource | null>(null);

  const tagList = useMemo(() => {
    const q = tagSearch.trim().toLowerCase();
    return Object.values(tags).filter((t) =>
      !q || t.id.toLowerCase().includes(q) || t.name.en?.toLowerCase().includes(q) || t.name.ru?.toLowerCase().includes(q)
    );
  }, [tags, tagSearch]);

  const sourceList = useMemo(() => Object.values(dataSources), [dataSources]);

  const selectTag = (id: string): void => {
    setSelectedTagId(id);
    setDraft({ ...tags[id] });
  };

  const selectSource = (id: string): void => {
    setSelectedSourceId(id);
    setSourceDraft({ ...dataSources[id] });
  };

  const addTag = (): void => {
    const id = generateId('tag');
    const newTag: HmiTag = {
      id,
      name: { en: 'New tag', ru: 'Новый тег', zh: '新标签' },
      dataType: 'float'
    };
    setHmiTags({ ...tags, [id]: newTag }, dataSources);
    setSelectedTagId(id);
    setDraft(newTag);
    setActivePanel('tags');
  };

  const deleteTag = (id: string): void => {
    const next = { ...tags };
    delete next[id];
    setHmiTags(next, dataSources);
    if (selectedTagId === id) {
      setSelectedTagId(null);
      setDraft(null);
    }
  };

  const addSource = (): void => {
    const id = generateId('src');
    const newSrc: DataSource = { id, kind: 'simulation', config: {} };
    setHmiTags(tags, { ...dataSources, [id]: newSrc });
    setSelectedSourceId(id);
    setSourceDraft(newSrc);
    setActivePanel('sources');
  };

  const deleteSource = (id: string): void => {
    const next = { ...dataSources };
    delete next[id];
    setHmiTags(tags, next);
    if (selectedSourceId === id) {
      setSelectedSourceId(null);
      setSourceDraft(null);
    }
  };

  const saveDraft = (): void => {
    if (!draft) return;
    setHmiTags({ ...tags, [draft.id]: draft }, dataSources);
  };

  const saveSourceDraft = (): void => {
    if (!sourceDraft) return;
    setHmiTags(tags, { ...dataSources, [sourceDraft.id]: sourceDraft });
  };

  const selectedTag = selectedTagId ? tags[selectedTagId] : null;

  return (
    <div className="workspace-root" data-workspace="tags">
      <aside className="workspace-sidebar">
        <div className="workspace-toolbar">
          <div className="sidebar-tab-row">
            <button
              type="button"
              className={activePanel === 'tags' ? 'active' : ''}
              onClick={() => setActivePanel('tags')}
            >
              <Tag size={14} />{labels.tagRegistry}
            </button>
            <button
              type="button"
              className={activePanel === 'sources' ? 'active' : ''}
              onClick={() => setActivePanel('sources')}
            >
              <Database size={14} />{labels.dataSources}
            </button>
          </div>
        </div>

        {activePanel === 'tags' ? (
          <>
            <div className="workspace-toolbar sidebar-search-row">
              <label className="sidebar-search">
                <Search size={14} />
                <input
                  type="search"
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  placeholder={labels.searchTags}
                />
              </label>
              <button type="button" title={labels.addTag} onClick={addTag}><Plus size={14} /></button>
            </div>
            <div className="entity-list">
              {tagList.length === 0
                ? <p className="entity-list-empty">{labels.noTags}</p>
                : tagList.map((tag) => (
                  <div
                    key={tag.id}
                    className={`entity-card${selectedTagId === tag.id ? ' active' : ''}`}
                    onClick={() => selectTag(tag.id)}
                  >
                    <span className="entity-card-label">{tag.name[language] || tag.name.en || tag.id}</span>
                    <span className="entity-card-meta">{tag.dataType}{tag.unit ? ` · ${tag.unit}` : ''}</span>
                    <button
                      type="button"
                      className="entity-card-delete"
                      title={labels.deleteTag}
                      onClick={(e) => { e.stopPropagation(); deleteTag(tag.id); }}
                    ><Trash2 size={12} /></button>
                  </div>
                ))
              }
            </div>
          </>
        ) : (
          <>
            <div className="workspace-toolbar sidebar-search-row">
              <span className="sidebar-section-title">{labels.dataSources}</span>
              <button type="button" title={labels.addDataSource} onClick={addSource}><Plus size={14} /></button>
            </div>
            <div className="entity-list">
              {sourceList.length === 0
                ? <p className="entity-list-empty">{labels.noTags}</p>
                : sourceList.map((src) => (
                  <div
                    key={src.id}
                    className={`entity-card${selectedSourceId === src.id ? ' active' : ''}`}
                    onClick={() => selectSource(src.id)}
                  >
                    <span className="entity-card-label">{src.id}</span>
                    <span className="entity-card-meta">{src.kind}</span>
                    <button
                      type="button"
                      className="entity-card-delete"
                      title={labels.deleteDataSource}
                      onClick={(e) => { e.stopPropagation(); deleteSource(src.id); }}
                    ><Trash2 size={12} /></button>
                  </div>
                ))
              }
            </div>
          </>
        )}
      </aside>

      <div className="workspace-splitter" />

      <section className="workspace-canvas-column hmi-editor-main">
        <div className="workspace-section-header">
          <span>{activePanel === 'tags' ? labels.tagEditor : labels.dataSources}</span>
          <button type="button" className="hmi-help-button" title={labels.showHelp} onClick={() => setShowTutorial(true)}>
            <HelpCircle size={15} />
          </button>
        </div>

        {activePanel === 'tags' ? (
          draft
            ? <TagForm
                draft={draft}
                labels={labels}
                language={language}
                dataSources={Object.values(dataSources)}
                onChange={setDraft}
                onSave={saveDraft}
              />
            : <div className="hmi-empty-state">{labels.noTagSelected}</div>
        ) : (
          sourceDraft
            ? <DataSourceForm
                draft={sourceDraft}
                labels={labels}
                onChange={setSourceDraft}
                onSave={saveSourceDraft}
              />
            : <div className="hmi-empty-state">{labels.noTagSelected}</div>
        )}
      </section>

      <div className="workspace-splitter" />

      <aside className="workspace-inspector">
        <div className="workspace-section-header">{labels.tagRegistry}</div>
        <div className="inspector-card">
          <p className="inspector-stat">
            <span>{labels.tagRegistry}</span>
            <strong>{Object.keys(tags).length}</strong>
          </p>
          <p className="inspector-stat">
            <span>{labels.dataSources}</span>
            <strong>{Object.keys(dataSources).length}</strong>
          </p>
        </div>
        {selectedTag ? (
          <div className="inspector-card">
            <div className="workspace-section-header">{labels.tagName}</div>
            <p className="inspector-detail"><strong>{selectedTag.name.en || selectedTag.id}</strong></p>
            <p className="inspector-detail">{selectedTag.dataType}{selectedTag.unit ? ` · ${selectedTag.unit}` : ''}</p>
            {selectedTag.sourceId ? <p className="inspector-detail">{labels.tagSourceId}: {selectedTag.sourceId}</p> : null}
          </div>
        ) : null}
        <div className="inspector-card hmi-type-legend">
          <div className="workspace-section-header">{labels.dataType}</div>
          {DATA_TYPES.map((dt) => (
            <div key={dt} className="hmi-type-row"><code>{dt}</code></div>
          ))}
        </div>
      </aside>

      {showTutorial ? (
        <TutorialOverlay workspace="tags" language={language} onClose={() => setShowTutorial(false)} />
      ) : null}
    </div>
  );
}

function TagForm({
  draft,
  labels,
  language,
  dataSources,
  onChange,
  onSave
}: {
  draft: HmiTag;
  labels: (typeof UI_TEXT)[keyof typeof UI_TEXT];
  language: string;
  dataSources: DataSource[];
  onChange: (tag: HmiTag) => void;
  onSave: () => void;
}): React.ReactElement {
  const set = (patch: Partial<HmiTag>): void => onChange({ ...draft, ...patch });
  const setName = (lang: 'en' | 'ru' | 'zh', value: string): void =>
    onChange({ ...draft, name: { ...draft.name, [lang]: value } });

  return (
    <form className="hmi-form" onSubmit={(e) => { e.preventDefault(); onSave(); }}>
      <div className="hmi-form-row">
        <label className="hmi-form-label">{labels.tagIdLabel}</label>
        <input className="hmi-form-input" value={draft.id} readOnly />
      </div>
      <div className="hmi-form-group">
        <div className="hmi-form-row">
          <label className="hmi-form-label">{labels.tagNameEn}</label>
          <input className="hmi-form-input" value={draft.name.en ?? ''} onChange={(e) => setName('en', e.target.value)} />
        </div>
        <div className="hmi-form-row">
          <label className="hmi-form-label">{labels.tagNameRu}</label>
          <input className="hmi-form-input" value={draft.name.ru ?? ''} onChange={(e) => setName('ru', e.target.value)} />
        </div>
        <div className="hmi-form-row">
          <label className="hmi-form-label">{labels.tagNameZh}</label>
          <input className="hmi-form-input" value={draft.name.zh ?? ''} onChange={(e) => setName('zh', e.target.value)} />
        </div>
      </div>
      <div className="hmi-form-row">
        <label className="hmi-form-label">{labels.dataType}</label>
        <select
          className="hmi-form-select"
          value={draft.dataType}
          onChange={(e) => set({ dataType: e.target.value as HmiTagDataType })}
        >
          {DATA_TYPES.map((dt) => <option key={dt} value={dt}>{dt}</option>)}
        </select>
      </div>
      <div className="hmi-form-row">
        <label className="hmi-form-label">{labels.tagUnit}</label>
        <input className="hmi-form-input" value={draft.unit ?? ''} onChange={(e) => set({ unit: e.target.value || undefined })} />
      </div>
      {(draft.dataType === 'float' || draft.dataType === 'int') ? (
        <>
          <div className="hmi-form-row">
            <label className="hmi-form-label">{labels.tagPrecision}</label>
            <input
              className="hmi-form-input"
              type="number"
              min={0}
              max={8}
              value={draft.precision ?? ''}
              onChange={(e) => set({ precision: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>
          <div className="hmi-form-row">
            <label className="hmi-form-label">{labels.tagMinValue}</label>
            <input
              className="hmi-form-input"
              type="number"
              value={draft.minValue ?? ''}
              onChange={(e) => set({ minValue: e.target.value !== '' ? Number(e.target.value) : undefined })}
            />
          </div>
          <div className="hmi-form-row">
            <label className="hmi-form-label">{labels.tagMaxValue}</label>
            <input
              className="hmi-form-input"
              type="number"
              value={draft.maxValue ?? ''}
              onChange={(e) => set({ maxValue: e.target.value !== '' ? Number(e.target.value) : undefined })}
            />
          </div>
        </>
      ) : null}
      <div className="hmi-form-row">
        <label className="hmi-form-label">{labels.tagSourceId}</label>
        <select
          className="hmi-form-select"
          value={draft.sourceId ?? ''}
          onChange={(e) => set({ sourceId: e.target.value || undefined })}
        >
          <option value="">{labels.none}</option>
          {dataSources.map((src) => <option key={src.id} value={src.id}>{src.id} ({src.kind})</option>)}
        </select>
      </div>
      <div className="hmi-form-row">
        <label className="hmi-form-label">{labels.tagAddress}</label>
        <input
          className="hmi-form-input"
          value={draft.address ?? ''}
          onChange={(e) => set({ address: e.target.value || undefined })}
        />
      </div>
      <div className="hmi-form-actions">
        <button type="submit" className="hmi-btn-primary">{labels.save}</button>
      </div>
    </form>
  );
}

function DataSourceForm({
  draft,
  labels,
  onChange,
  onSave
}: {
  draft: DataSource;
  labels: (typeof UI_TEXT)[keyof typeof UI_TEXT];
  onChange: (src: DataSource) => void;
  onSave: () => void;
}): React.ReactElement {
  const set = (patch: Partial<DataSource>): void => onChange({ ...draft, ...patch });
  const configStr = JSON.stringify(draft.config, null, 2);
  const [configText, setConfigText] = useState(configStr);
  const [configError, setConfigError] = useState('');

  const handleConfigChange = (text: string): void => {
    setConfigText(text);
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      set({ config: parsed });
      setConfigError('');
    } catch {
      setConfigError('Invalid JSON');
    }
  };

  return (
    <form className="hmi-form" onSubmit={(e) => { e.preventDefault(); onSave(); }}>
      <div className="hmi-form-row">
        <label className="hmi-form-label">{labels.tagIdLabel}</label>
        <input className="hmi-form-input" value={draft.id} readOnly />
      </div>
      <div className="hmi-form-row">
        <label className="hmi-form-label">{labels.dataSourceKind}</label>
        <select
          className="hmi-form-select"
          value={draft.kind}
          onChange={(e) => set({ kind: e.target.value as DataSourceKind })}
        >
          {SOURCE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      <div className="hmi-form-row hmi-form-row-column">
        <label className="hmi-form-label">Config (JSON)</label>
        <textarea
          className={`hmi-form-textarea${configError ? ' hmi-input-error' : ''}`}
          value={configText}
          onChange={(e) => handleConfigChange(e.target.value)}
          rows={6}
          spellCheck={false}
        />
        {configError ? <span className="hmi-field-error">{configError}</span> : null}
      </div>
      <div className="hmi-form-actions">
        <button type="submit" className="hmi-btn-primary" disabled={Boolean(configError)}>{labels.save}</button>
      </div>
    </form>
  );
}
