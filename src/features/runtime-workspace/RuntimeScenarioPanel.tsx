import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, CircleDot, Play, Route, XCircle } from 'lucide-react';
import type { LcdBitmapProject } from '../../domain/project';
import type { UiText } from '../../renderer/config/i18n';
import { runUxScenario, type UxScenarioResult } from '../../services/ux/uxScenarioRunner';

interface RuntimeScenarioPanelProps {
  project: LcdBitmapProject;
  labels: UiText;
  onStartAtState: (stateId?: string) => void;
}

interface MapPosition {
  x: number;
  y: number;
}

const MAP_NODE_WIDTH = 118;
const MAP_NODE_HEIGHT = 38;

export function RuntimeScenarioPanel({ project, labels, onStartAtState }: RuntimeScenarioPanelProps): React.ReactElement {
  const scenarios = project.uxContract?.scenarios ?? [];
  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id ?? '');
  const [result, setResult] = useState<UxScenarioResult | null>(null);
  const [running, setRunning] = useState(false);
  const scenario = scenarios.find((candidate) => candidate.id === scenarioId) ?? null;

  useEffect(() => {
    if (!scenarios.some((candidate) => candidate.id === scenarioId)) {
      setScenarioId(scenarios[0]?.id ?? '');
      setResult(null);
    }
  }, [scenarios, scenarioId]);

  const run = async (): Promise<void> => {
    if (!scenario) return;
    setRunning(true);
    try {
      setResult(await runUxScenario(project, scenario));
    } finally {
      setRunning(false);
    }
  };

  if (scenarios.length === 0) {
    return <p className="runtime-empty-hint">{labels.runtimeNoScenarios}</p>;
  }

  return (
    <section className="runtime-scenario-panel" aria-label={labels.runtimeScenarios}>
      <label>
        <span>{labels.runtimeSelectScenario}</span>
        <select value={scenarioId} onChange={(event) => { setScenarioId(event.target.value); setResult(null); }}>
          {scenarios.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title}</option>)}
        </select>
      </label>
      <div className="runtime-scenario-actions">
        <button type="button" onClick={() => void run()} disabled={running}>
          <Play size={14} /> {running ? labels.runtimeScenarioRunning : labels.runtimeRunScenario}
        </button>
        {scenario?.initialStateId ? (
          <button type="button" onClick={() => onStartAtState(scenario.initialStateId)}>
            <CircleDot size={14} /> {labels.runtimeScenarioStartAt}
          </button>
        ) : null}
      </div>

      <ScenarioRouteMap project={project} result={result} labels={labels} onStartAtState={onStartAtState} />

      {result ? (
        <>
          <div className={`runtime-scenario-result ${result.passed ? 'passed' : 'failed'}`}>
            {result.passed ? <CheckCircle size={15} /> : <XCircle size={15} />}
            <strong>{result.passed ? labels.runtimeScenarioPass : labels.runtimeScenarioFail}</strong>
            <span>{result.initialStateId ?? '—'} → {result.finalStateId ?? '—'}</span>
          </div>
          <ol className="runtime-scenario-trace" aria-label={labels.runtimeScenarioTrace}>
            {result.trace.steps.map((step) => (
              <li key={step.index} className={step.blocked ? 'blocked' : ''}>
                <span>#{step.index + 1}</span>
                <span>{step.stateIdBefore ?? '—'} → {step.stateIdAfter ?? '—'}</span>
                {step.blocked ? <small>{step.blockReason}</small> : null}
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </section>
  );
}

function ScenarioRouteMap({ project, result, labels, onStartAtState }: {
  project: LcdBitmapProject;
  result: UxScenarioResult | null;
  labels: UiText;
  onStartAtState: (stateId: string) => void;
}): React.ReactElement {
  const { positions, width, height } = useMemo(() => routeMapLayout(project), [project]);
  const visitedStates = new Set<string>(result ? [
    result.initialStateId ?? '',
    ...result.trace.steps.flatMap((step) => [step.stateIdBefore ?? '', step.stateIdAfter ?? ''])
  ] : []);
  const visitedTransitions = new Set(result?.trace.steps.map((step) => step.transitionId).filter((id): id is string => Boolean(id)) ?? []);

  return (
    <section className="runtime-route-map" aria-label={labels.runtimeScenarioRoute}>
      <header><Route size={14} /> {labels.runtimeScenarioRoute}</header>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={labels.runtimeScenarioRoute}>
        {project.fsm.transitionOrder.map((transitionId) => {
          const transition = project.fsm.transitions[transitionId];
          if (!transition) return null;
          const from = positions[transition.from];
          const to = positions[transition.to];
          if (!from || !to) return null;
          return <line key={transition.id} className={visitedTransitions.has(transition.id) ? 'visited' : ''} x1={from.x + MAP_NODE_WIDTH / 2} y1={from.y + MAP_NODE_HEIGHT / 2} x2={to.x + MAP_NODE_WIDTH / 2} y2={to.y + MAP_NODE_HEIGHT / 2} />;
        })}
        {project.fsm.stateOrder.map((stateId) => {
          const state = project.fsm.states[stateId];
          const position = positions[stateId];
          if (!state || !position) return null;
          const label = state.title || stateId;
          const activate = (): void => onStartAtState(stateId);
          return (
            <g
              key={stateId}
              className={visitedStates.has(stateId) ? 'visited' : ''}
              role="button"
              tabIndex={0}
              aria-label={`${labels.runtimeScenarioStartAt}: ${label}`}
              onClick={activate}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); } }}
            >
              <rect x={position.x} y={position.y} width={MAP_NODE_WIDTH} height={MAP_NODE_HEIGHT} rx={6} />
              <text x={position.x + MAP_NODE_WIDTH / 2} y={position.y + 23}>{label.slice(0, 18)}</text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}

function routeMapLayout(project: LcdBitmapProject): { positions: Record<string, MapPosition>; width: number; height: number } {
  const raw = project.fsm.stateOrder.map((stateId, index) => {
    const point = project.fsm.graphLayout[stateId];
    return { stateId, x: point?.x ?? (index % 3) * 150, y: point?.y ?? Math.floor(index / 3) * 80 };
  });
  const minX = Math.min(0, ...raw.map((point) => point.x));
  const minY = Math.min(0, ...raw.map((point) => point.y));
  const positions = Object.fromEntries(raw.map((point) => [point.stateId, { x: point.x - minX + 12, y: point.y - minY + 12 }]));
  return {
    positions,
    width: Math.max(280, ...Object.values(positions).map((point) => point.x + MAP_NODE_WIDTH + 12)),
    height: Math.max(130, ...Object.values(positions).map((point) => point.y + MAP_NODE_HEIGHT + 12))
  };
}
