import type React from 'react';
import { useMemo, useState } from 'react';
import type { FsmLayer, FsmLayerVisibilityPreset, FsmState } from '../../domain/project';
import type { UiText } from '../../renderer/config/i18n';

const GENERAL_LAYER = 'user';
const LAYER_COLORS = ['#2563eb', '#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626'];
const LAYER_TARGET_CONTROL = 'screen-layer-target';

export function ScreenLayerManager({
  layers,
  selectedStateIds,
  states,
  presets,
  labels,
  onUpdateStates,
  onUpdateLayers
}: {
  layers: FsmLayer[];
  selectedStateIds: string[];
  states: Record<string, FsmState>;
  presets: Record<string, FsmLayerVisibilityPreset>;
  labels: UiText;
  onUpdateStates: (updates: Record<string, Partial<FsmState>>) => void;
  onUpdateLayers: (layers: FsmLayer[], presets: Record<string, FsmLayerVisibilityPreset>) => void;
}): React.ReactElement {
  const [newLayer, setNewLayer] = useState('');
  const [targetLayer, setTargetLayer] = useState(layers[0]?.id ?? GENERAL_LAYER);
  const [renameLayer, setRenameLayer] = useState('');
  const [presetName, setPresetName] = useState('');
  const selectedIds = useMemo(() => selectedStateIds.filter((stateId) => Boolean(states[stateId])), [selectedStateIds, states]);
  const layerCounts = useMemo(() => new Map(layers.map((layer) => [
    layer.id,
    Object.values(states).filter((state) => (state.subsystem || GENERAL_LAYER) === layer.id).length
  ])), [layers, states]);
  const selectedLayer = layers.find((layer) => layer.id === targetLayer) ?? layers[0];
  const validName = (value: string): string | null => {
    const normalized = value.trim().slice(0, 80);
    if (!normalized || layers.some((layer) => layer.name.toLocaleLowerCase() === normalized.toLocaleLowerCase())) return null;
    return normalized;
  };
  const assign = (layerId: string): void => {
    if (!selectedIds.length || !layers.some((layer) => layer.id === layerId)) return;
    onUpdateStates(Object.fromEntries(selectedIds.map((stateId) => [stateId, { subsystem: layerId }])));
  };
  const persist = (next: FsmLayer[], nextPresets = presets): void => onUpdateLayers(next, nextPresets);
  const createAndAssign = (): void => {
    const name = validName(newLayer);
    if (!name) return;
    const idBase = name.toLocaleLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '') || 'layer';
    let id = idBase;
    let suffix = 2;
    while (layers.some((layer) => layer.id === id)) id = `${idBase}-${suffix++}`;
    const layer: FsmLayer = { id, name, color: LAYER_COLORS[layers.length % LAYER_COLORS.length], icon: 'layers', description: '' };
    persist([...layers, layer]);
    setTargetLayer(id);
    setNewLayer('');
    if (selectedIds.length) onUpdateStates(Object.fromEntries(selectedIds.map((stateId) => [stateId, { subsystem: id }])));
  };
  const rename = (): void => {
    const name = validName(renameLayer);
    if (!name || !selectedLayer || selectedLayer.id === GENERAL_LAYER) return;
    persist(layers.map((layer) => layer.id === selectedLayer.id ? { ...layer, name } : layer));
    setRenameLayer('');
  };
  const remove = (): void => {
    if (!selectedLayer || selectedLayer.id === GENERAL_LAYER) return;
    const affected = Object.values(states).filter((state) => (state.subsystem || GENERAL_LAYER) === selectedLayer.id);
    if (!window.confirm(`Переместить ${affected.length} экран(ов) из слоя «${selectedLayer.name}» в общий слой?`)) return;
    if (affected.length) onUpdateStates(Object.fromEntries(affected.map((state) => [state.id, { subsystem: GENERAL_LAYER }])));
    const nextPresets = Object.fromEntries(Object.entries(presets).map(([id, preset]) => [id, {
      ...preset,
      layerIds: preset.layerIds.filter((layerId) => layerId !== selectedLayer.id)
    }]));
    persist(layers.filter((layer) => layer.id !== selectedLayer.id), nextPresets);
    setTargetLayer(GENERAL_LAYER);
  };
  const savePreset = (): void => {
    const name = presetName.trim().slice(0, 80);
    if (!name) return;
    const id = `preset-${Date.now().toString(36)}`;
    persist(layers, { ...presets, [id]: { id, name, layerIds: selectedIds.length
      ? [...new Set(selectedIds.map((stateId) => states[stateId]?.subsystem || GENERAL_LAYER))]
      : layers.map((layer) => layer.id) } });
    setPresetName('');
  };

  return (
    <section className="screen-layer-manager" aria-label={labels.screenLayerManagerAria}>
      <p>{labels.selectedScreensCount}: <strong>{selectedIds.length}</strong></p>
      <label>
        {labels.assignSelected}
        <select aria-label={LAYER_TARGET_CONTROL} value={targetLayer} onChange={(event) => setTargetLayer(event.target.value)}>
          {layers.map((layer) => <option key={layer.id} value={layer.id}>{layer.name} · {layerCounts.get(layer.id) ?? 0}</option>)}
        </select>
      </label>
      <button type="button" disabled={!selectedIds.length} onClick={() => assign(targetLayer)}>{labels.assignToLayer}</button>
      <div className="screen-layer-manager-row">
        <input value={newLayer} onChange={(event) => setNewLayer(event.target.value)} placeholder={labels.newLayerPlaceholder} maxLength={80} />
        <button type="button" disabled={!validName(newLayer)} onClick={createAndAssign}>{labels.createLayer}</button>
      </div>
      <div className="screen-layer-manager-row">
        <input value={renameLayer} onChange={(event) => setRenameLayer(event.target.value)} placeholder={labels.renameLayerPlaceholder} maxLength={80} />
        <button type="button" disabled={!selectedLayer || selectedLayer.id === GENERAL_LAYER || !validName(renameLayer)} onClick={rename}>{labels.renameLayerButton}</button>
      </div>
      {selectedLayer ? <div className="screen-layer-style-row">
        <input aria-label={labels.layerColorAria} type="color" value={selectedLayer.color} onChange={(event) => persist(layers.map((layer) => layer.id === selectedLayer.id ? { ...layer, color: event.target.value } : layer))} />
        <input aria-label={labels.layerDescriptionAria} value={selectedLayer.description ?? ''} onChange={(event) => persist(layers.map((layer) => layer.id === selectedLayer.id ? { ...layer, description: event.target.value.slice(0, 160) } : layer))} placeholder={labels.layerDescriptionPlaceholder} />
      </div> : null}
      <div className="screen-layer-manager-row">
        <input value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder={labels.visibilityPresetPlaceholder} maxLength={80} />
        <button type="button" disabled={!presetName.trim()} onClick={savePreset}>{labels.savePreset}</button>
      </div>
      <button type="button" className="delete-button" disabled={!selectedLayer || selectedLayer.id === GENERAL_LAYER} onClick={remove}>{labels.deleteLayer}</button>
    </section>
  );
}
