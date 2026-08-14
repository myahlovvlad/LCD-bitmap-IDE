import type React from 'react';
import { memo, useEffect, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useProjectStore } from '../store/projectStore';
import type { FsmState } from '../../domain/project';

export interface FsmStateNodeData extends Record<string, unknown> {
  compact?: boolean;
  state: FsmState;
  screenName?: string | null;
  allowedButtons: string[];
  stateMark: { kind: string; label: string };
  editingEnabled?: boolean;
}

export const StateNode = memo(function StateNode({ id, selected, data }: NodeProps): React.ReactElement {
  const nodeData = data as unknown as FsmStateNodeData;
  const { state, allowedButtons, stateMark } = nodeData;
  const compact = Boolean(nodeData.compact);
  const editingEnabled = Boolean(nodeData.editingEnabled);
  const selectedStateId = useProjectStore((store) => store.selectedStateId);
  const selectState = useProjectStore((state) => state.selectState);
  const updateFsmState = useProjectStore((state) => state.updateFsmState);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(state.title || id);
  const skipBlurRef = useRef(false);
  const isSelected = selected || selectedStateId === id;

  useEffect(() => {
    if (!editing) setDraft(state.title || id);
  }, [editing, id, state.title]);

  const finishEditing = (commit: boolean): void => {
    skipBlurRef.current = true;
    if (commit && draft !== (state.title || id)) updateFsmState(id, { title: draft });
    else if (!commit) setDraft(state.title || id);
    setEditing(false);
  };

  return (
    <div
      className={`${isSelected ? 'state-node selected' : 'state-node'}${compact ? ' compact' : ''}`}
      onClick={() => selectState(id)}
      onDoubleClick={() => { if (editingEnabled) setEditing(true); }}
      role="button"
      tabIndex={0}
      aria-readonly={!editingEnabled}
    >
      {/* Connection handles on all 4 sides (Visio-like) */}
      {editingEnabled ? <>
        <Handle type="target" position={Position.Top} id="t-top" className="node-handle node-handle-target node-handle-top" />
        <Handle type="source" position={Position.Top} id="s-top" className="node-handle node-handle-source node-handle-top" />
        <Handle type="target" position={Position.Right} id="t-right" className="node-handle node-handle-target node-handle-right" />
        <Handle type="source" position={Position.Right} id="s-right" className="node-handle node-handle-source node-handle-right" />
        <Handle type="target" position={Position.Bottom} id="t-bottom" className="node-handle node-handle-target node-handle-bottom" />
        <Handle type="source" position={Position.Bottom} id="s-bottom" className="node-handle node-handle-source node-handle-bottom" />
        <Handle type="target" position={Position.Left} id="t-left" className="node-handle node-handle-target node-handle-left" />
        <Handle type="source" position={Position.Left} id="s-left" className="node-handle node-handle-source node-handle-left" />
      </> : null}

      {editing ? (
        <input
          className="state-node-title-input"
          value={draft}
          autoFocus
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (skipBlurRef.current) skipBlurRef.current = false;
            else finishEditing(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') finishEditing(true);
            if (event.key === 'Escape') finishEditing(false);
          }}
        />
      ) : (
        <strong>{state.title || id}</strong>
      )}
      <small>{id} / {state.subsystem || 'unknown'}</small>
      <span className={`state-node-flags state-node-flags-${stateMark.kind}`}>{stateMark.label}</span>
      <div className="state-node-runtime" title={nodeData.screenName ? `Связанный LCD-экран: ${nodeData.screenName}` : 'LCD-экран не привязан'}>
        <span className={nodeData.screenName ? 'state-node-screen linked' : 'state-node-screen'}>{nodeData.screenName ? `LCD · ${nodeData.screenName}` : 'LCD не привязан'}</span>
        <span className="state-node-buttons" title={allowedButtons.length ? `Разрешены: ${allowedButtons.join(', ')}` : 'Нет разрешённых кнопок'}>
          {allowedButtons.length ? allowedButtons.slice(0, 3).map((button) => <b key={button}>{button}</b>) : <b>—</b>}
          {allowedButtons.length > 3 ? <b>+{allowedButtons.length - 3}</b> : null}
        </span>
      </div>
    </div>
  );
});
