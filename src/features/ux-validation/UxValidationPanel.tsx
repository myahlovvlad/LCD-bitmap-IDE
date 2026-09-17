import type React from 'react';
import { useMemo, useState } from 'react';
import { useWorkspaceRouter } from '../../app/WorkspaceRouter';
import { UI_TEXT } from '../../renderer/config/i18n';
import { useProjectStore } from '../../renderer/store/projectStore';
import type { UxFindingCategory, UxValidationFinding } from '../../services/ux/uxTypes';
import type { UxFindingSeverity } from '../../domain/uxContract';
import { resolveNavigationTarget } from './uxFindingNavigation';

const SEVERITIES: UxFindingSeverity[] = ['error', 'warning', 'info', 'suggestion', 'needs_human_review'];

export function UxValidationPanel(): React.ReactElement {
  const { project, language, uxAnalysis, runUxAnalysis, selectState, selectTransition, selectScreen, selectControlElements } = useProjectStore();
  const { navigate } = useWorkspaceRouter();
  const labels = UI_TEXT[language];

  const [severityFilter, setSeverityFilter] = useState<Set<UxFindingSeverity>>(new Set(SEVERITIES));
  const [categoryFilter, setCategoryFilter] = useState<UxFindingCategory | 'all'>('all');
  const [running, setRunning] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  if (!project) {
    return <section className="workspace-empty">{labels.noProjectLoaded}</section>;
  }

  const report = uxAnalysis?.report;

  const run = async (withScenarios: boolean) => {
    setRunning(true);
    try {
      await runUxAnalysis({ includeScenarioExecution: withScenarios, includeVisualChecks: true });
    } finally {
      setRunning(false);
    }
  };

  const categories = useMemo(() => {
    if (!report) return [] as UxFindingCategory[];
    return [...new Set(report.findings.map((f) => f.category))].sort();
  }, [report]);

  const visibleFindings = useMemo(() => {
    if (!report) return [] as UxValidationFinding[];
    return report.findings.filter((finding) =>
      severityFilter.has(finding.severity) &&
      (categoryFilter === 'all' || finding.category === categoryFilter) &&
      !dismissed.has(finding.id)
    );
  }, [report, severityFilter, categoryFilter, dismissed]);

  const toggleSeverity = (severity: UxFindingSeverity) => {
    setSeverityFilter((current) => {
      const next = new Set(current);
      if (next.has(severity)) next.delete(severity); else next.add(severity);
      return next;
    });
  };

  const goToFinding = (finding: UxValidationFinding) => {
    const target = resolveNavigationTarget(finding);
    if (!target) return;
    navigate(target);
    if (target.mode === 'fsm' && target.stateId) selectState(target.stateId);
    if (target.mode === 'fsm' && target.transitionId) selectTransition(target.transitionId);
    if (target.mode === 'lcd' && target.screenId) selectScreen(target.screenId);
    if (target.mode === 'control-panel' && target.elementId) selectControlElements([target.elementId]);
  };

  const verdictLabel = report
    ? report.verdict === 'pass' ? labels.uxVerdictPass : report.verdict === 'fail' ? labels.uxVerdictFail : labels.uxVerdictNeedsReview
    : null;

  return (
    <section className="workspace-panel ux-validation-panel">
      <header className="ux-validation-header">
        <h2>{labels.uxValidationWorkspace}</h2>
        <div className="ux-validation-actions">
          <button type="button" disabled={running} onClick={() => run(false)}>{labels.uxRunAnalysis}</button>
          <button type="button" disabled={running} onClick={() => run(true)}>{labels.uxRunAnalysisWithScenarios}</button>
        </div>
        {report ? (
          <span className={`ux-verdict-badge ux-verdict-${report.verdict}`}>{verdictLabel}</span>
        ) : null}
      </header>

      {!report ? (
        <p className="validation-empty">{labels.uxNoFindings}</p>
      ) : (
        <>
          <section className="ux-coverage" aria-label={labels.uxCoverageLabel}>
            <h3>{labels.uxCoverageLabel}</h3>
            <ul>
              {Object.entries(report.coverage).map(([key, metric]) => (
                <li key={key}>{key}: {metric.covered}/{metric.total}</li>
              ))}
            </ul>
          </section>

          <section className="ux-filters">
            <fieldset>
              <legend>{labels.uxSeverityLabel}</legend>
              {SEVERITIES.map((severity) => (
                <label key={severity} className="ux-filter-checkbox">
                  <input type="checkbox" checked={severityFilter.has(severity)} onChange={() => toggleSeverity(severity)} />
                  {severity}
                </label>
              ))}
            </fieldset>
            <label>
              {labels.uxCategoryLabel}
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as UxFindingCategory | 'all')}>
                <option value="all">{labels.uxAllCategories}</option>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
          </section>

          <div className="validation-list ux-finding-list">
            {visibleFindings.length === 0 ? (
              <p className="validation-empty">{labels.uxNoFindings}</p>
            ) : (
              visibleFindings.map((finding) => (
                <article key={finding.id} className={`validation-issue ux-finding severity-${finding.severity}`}>
                  <strong>{finding.severity}</strong>
                  <span className="ux-finding-rule">{finding.ruleId}</span>
                  <span>{finding.message}</span>
                  {finding.remediation ? <small>{finding.remediation}</small> : null}
                  {finding.source === 'heuristic_llm' ? (
                    <span className="ux-finding-heuristic-badge">{labels.uxHeuristicUnreviewed}</span>
                  ) : null}
                  <div className="ux-finding-actions">
                    {resolveNavigationTarget(finding) ? (
                      <button type="button" className="validation-fix-button" onClick={() => goToFinding(finding)}>
                        {labels.goToEntity}
                      </button>
                    ) : null}
                    {finding.source === 'heuristic_llm' ? (
                      <button type="button" className="validation-fix-button" onClick={() => setDismissed((d) => new Set(d).add(finding.id))}>
                        {labels.delete}
                      </button>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}
