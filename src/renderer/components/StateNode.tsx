import type React from 'react';
import { useState } from 'react';
import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react';
import { LCDCanvas } from './LCDCanvas';
import { FontRenderer } from '../core/fonts';
import { useProjectStore } from '../store/projectStore';
import { UI_TEXT, type UiText } from '../config/i18n';

export function StateNode({ id, selected, data }: NodeProps): React.ReactElement {
  const compact = Boolean((data as { compact?: boolean } | undefined)?.compact);
  const showPreview = Boolean((data as { showPreview?: boolean } | undefined)?.showPreview);
  const language = useProjectStore((state) => state.language);
  const project = useProjectStore((state) => state.project);
  const fontGlyphs = useProjectStore((state) => state.fontGlyphs);
  const selectState = useProjectStore((state) => state.selectState);
  const updateFsmState = useProjectStore((state) => state.updateFsmState);
  const [editing, setEditing] = useState(false);
  const fsmState = project?.fsm.states[id];
  const screen = fsmState?.screenId ? project?.screens[fsmState.screenId] : null;
  const canvasData = screen ? {
    stateId: screen.id,
    width: screen.width,
    height: screen.height,
    objects: screen.objects,
    selectedObjectIds: [],
    updatedAt: screen.updatedAt
  } : null;
  const labels = UI_TEXT[language];

  const stateMark = getStateMark(labels, fsmState?.stateType, fsmState?.initial, fsmState?.terminal);
  return (
    <div
      className={`${selected ? 'state-node selected' : 'state-node'}${compact ? ' compact' : ''}`}
      onClick={() => selectState(id)}
      onDoubleClick={() => setEditing(true)}
      role="button"
      tabIndex={0}
    >
      <NodeResizer
        minWidth={120}
        minHeight={compact ? 54 : 70}
        isVisible={selected}
        lineStyle={{ borderColor: '#22c55e' }}
        handleStyle={{ background: '#22c55e', borderColor: '#16a34a' }}
      />

      {/* Connection handles on all 4 sides (Visio-like) */}
      <Handle type="target" position={Position.Top} id="t-top" className="node-handle node-handle-target" />
      <Handle type="source" position={Position.Top} id="s-top" className="node-handle node-handle-source" />
      <Handle type="target" position={Position.Right} id="t-right" className="node-handle node-handle-target" />
      <Handle type="source" position={Position.Right} id="s-right" className="node-handle node-handle-source" />
      <Handle type="target" position={Position.Bottom} id="t-bottom" className="node-handle node-handle-target" />
      <Handle type="source" position={Position.Bottom} id="s-bottom" className="node-handle node-handle-source" />
      <Handle type="target" position={Position.Left} id="t-left" className="node-handle node-handle-target" />
      <Handle type="source" position={Position.Left} id="s-left" className="node-handle node-handle-source" />

      {editing ? (
        <input
          className="state-node-title-input"
          value={fsmState?.title || id}
          autoFocus
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => updateFsmState(id, { title: event.target.value })}
          onBlur={() => setEditing(false)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === 'Escape') {
              setEditing(false);
            }
          }}
        />
      ) : (
        <strong>{fsmState?.title || id}</strong>
      )}
      <small>{id} / {fsmState?.subsystem ?? 'unknown'}</small>
      <span className={`state-node-flags state-node-flags-${stateMark.kind}`}>{stateMark.label}</span>
      {canvasData && !compact && showPreview ? (
        <LCDCanvas
          canvasData={canvasData}
          language={language}
          scale={1}
          className="state-node-lcd"
          fontRenderer={new FontRenderer(fontGlyphs)}
        />
      ) : null}
    </div>
  );
}

function getStateMark(
  labels: UiText,
  stateType: string | undefined,
  initial: boolean | undefined,
  terminal: boolean | undefined
): { kind: string; label: string } {
  if (initial || stateType === 'initial') {
    return { kind: 'initial', label: labels.initialState };
  }
  if (stateType === 'failure') {
    return { kind: 'failure', label: labels.failureState };
  }
  if (terminal || stateType === 'success') {
    return { kind: 'success', label: labels.successState };
  }
  return { kind: 'process', label: labels.processState };
}
