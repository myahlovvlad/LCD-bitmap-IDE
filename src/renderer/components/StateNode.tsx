import type React from 'react';
import { memo, useState } from 'react';
import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react';
import { useProjectStore } from '../store/projectStore';
import type { FsmState } from '../../domain/project';

export interface FsmStateNodeData extends Record<string, unknown> {
  compact?: boolean;
  state: FsmState;
  screenName?: string | null;
  allowedButtons: string[];
  stateMark: { kind: string; label: string };
}

export const StateNode = memo(function StateNode({ id, selected, data }: NodeProps): React.ReactElement {
  const nodeData = data as unknown as FsmStateNodeData;
  const { state, allowedButtons, stateMark } = nodeData;
  const compact = Boolean(nodeData.compact);
  const selectedStateId = useProjectStore((store) => store.selectedStateId);
  const selectState = useProjectStore((state) => state.selectState);
  const updateFsmState = useProjectStore((state) => state.updateFsmState);
  const [editing, setEditing] = useState(false);
  const isSelected = selected || selectedStateId === id;
  return (
    <div
      className={`${isSelected ? 'state-node selected' : 'state-node'}${compact ? ' compact' : ''}`}
      onClick={() => selectState(id)}
      onDoubleClick={() => setEditing(true)}
      role="button"
      tabIndex={0}
    >
      <NodeResizer
        minWidth={120}
        minHeight={compact ? 54 : 70}
        isVisible={isSelected}
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
          value={state.title || id}
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
