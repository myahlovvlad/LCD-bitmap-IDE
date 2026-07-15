import type React from 'react';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ValidationDomain, ValidationIssue } from '../../domain/project';

export function ValidationPanel({
  issues,
  domain,
  title = 'Validation',
  onSelectEntity,
  onFixInitialState,
  defaultCollapsed = false
}: {
  issues: readonly ValidationIssue[];
  domain?: ValidationDomain;
  title?: string;
  onSelectEntity?: (entityType: string, entityId: string) => void;
  onFixInitialState?: () => void;
  /** Collapse the panel by default when there are no errors. */
  defaultCollapsed?: boolean;
}): React.ReactElement {
  const visible = domain ? issues.filter((issue) => issue.domain === domain) : issues;
  const errorCount = visible.filter((i) => i.severity === 'error').length;
  const warnCount  = visible.filter((i) => i.severity === 'warning').length;

  // Auto-collapse when clean; expand when there are errors
  const [collapsed, setCollapsed] = useState(() => defaultCollapsed && errorCount === 0);

  const toggleCollapsed = (): void => setCollapsed((v) => !v);

  const badgeClass = errorCount > 0
    ? 'validation-badge-error'
    : warnCount > 0
      ? 'validation-badge-warn'
      : 'validation-badge-ok';

  return (
    <section
      className={`validation-panel${collapsed ? ' validation-panel-collapsed' : ''}`}
      aria-label={title}
    >
      <header
        role="button"
        tabIndex={0}
        className="validation-panel-header-btn"
        onClick={toggleCollapsed}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleCollapsed(); }}
        aria-expanded={!collapsed}
      >
        <span className="validation-collapse-icon">
          {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
        </span>
        <h3>{title}</h3>
        <span className={`validation-badge ${badgeClass}`} aria-label={`${visible.length} issues`}>
          {errorCount > 0 ? `${errorCount}✗` : warnCount > 0 ? `${warnCount}⚠` : '✓'}
        </span>
      </header>

      {!collapsed ? (
        visible.length === 0 ? (
          <p className="validation-empty">No validation issues.</p>
        ) : (
          <div className="validation-list">
            {visible.map((issue) => {
              const isInitialMissing = issue.id.startsWith('fsm:initial-missing');
              const canSelect = Boolean(onSelectEntity && issue.entityId && issue.entityType !== 'fsm');
              return (
                <article key={issue.id} className={`validation-issue severity-${issue.severity}`}>
                  <strong>{issue.severity}</strong>
                  <span>{issue.message}</span>
                  {issue.suggestedFix ? <small>{issue.suggestedFix}</small> : null}
                  {isInitialMissing && onFixInitialState ? (
                    <button type="button" className="validation-fix-button" onClick={onFixInitialState}>
                      Fix: mark first state as initial
                    </button>
                  ) : null}
                  {canSelect ? (
                    <button
                      type="button"
                      className="validation-fix-button"
                      onClick={() => onSelectEntity!(issue.entityType, issue.entityId!)}
                    >
                      Go to {issue.entityType}
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        )
      ) : null}
    </section>
  );
}
