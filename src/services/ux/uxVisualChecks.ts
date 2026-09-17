/**
 * Deterministic visual/screen semantics checks (Part E). Reuses the existing render +
 * layout-analysis pipeline already used by export_screen_html/analyze_128x64_screens —
 * no separate render logic, no LLM, no color heuristics (the target display is monochrome).
 */
import type { LcdBitmapProject } from '../../domain/project';
import { analyzeScreenLayout } from '../../compiler/analysis/screenLayoutAnalysis';
import { renderProjectScreen } from '../../compiler/evidence/softwareEvidenceBundle';
import { controlsAvailableOnState } from './uxGraphAlgorithms';
import type { ProjectUxGraph } from './uxGraphBuilder';
import { makeFinding, type UxValidationFinding } from './uxTypes';

export function evaluateVisualChecks(project: LcdBitmapProject, graph: ProjectUxGraph): UxValidationFinding[] {
  const findings: UxValidationFinding[] = [];
  const language = project.authoringLanguage ?? graph.contract.policies.defaultLocale;

  for (const screen of graph.screens) {
    if (screen.stateIds.length === 0 && screen.visibleTextObjectIds.length === 0) {
      // Unused/placeholder screens have nothing to render meaningfully; skip.
    } else {
      try {
        const rendered = renderProjectScreen({ project, language, screenId: screen.screenId });
        const layout = analyzeScreenLayout(rendered.screen, language);
        for (const issue of layout.issues) {
          findings.push(makeFinding({
            ruleId: issue.code === 'clipped' ? 'ux.visual-text-overflow' : 'ux.visual-control-overlap',
            category: 'visual',
            severity: issue.severity,
            message: `Screen "${screen.name}" (${screen.screenId}): ${issue.message}`,
            affected: { screenIds: [screen.screenId], elementIds: [...issue.objectIds] },
            evidence: { bounds: issue.bounds }
          }));
        }
      } catch {
        // Screen cannot be rendered standalone (e.g. empty canvas) — not a UX-visual concern.
      }
    }

    if ((screen.role === 'error' || screen.role === 'warning') && !screen.hasVisibleText) {
      findings.push(makeFinding({
        ruleId: 'ux.visual-missing-explanation-text',
        category: 'visual',
        severity: 'warning',
        message: `Screen "${screen.name}" (${screen.screenId}) has role "${screen.role}" but no visible text object.`,
        affected: { screenIds: [screen.screenId] },
        remediation: 'Add a text object explaining the condition to the operator.'
      }));
    }

    if (screen.role === 'confirmation' && screen.stateIds.length > 0) {
      const controlsHere = screen.stateIds.flatMap((id) => controlsAvailableOnState(graph, id));
      const hasConfirm = controlsHere.some((c) => c.actionKind === 'confirm');
      const hasCancel = controlsHere.some((c) => c.actionKind === 'cancel' || c.actionKind === 'back');
      if (!hasConfirm || !hasCancel) {
        findings.push(makeFinding({
          ruleId: 'ux.visual-confirmation-incomplete',
          category: 'visual',
          severity: 'warning',
          message: `Confirmation screen "${screen.name}" (${screen.screenId}) is missing a ${!hasConfirm ? 'confirm' : 'cancel'} control.`,
          affected: { screenIds: [screen.screenId] },
          remediation: 'Add both a confirm and a cancel control to this confirmation screen.'
        }));
      }
    }
  }

  for (const control of graph.controls) {
    if (!control.label.trim()) {
      findings.push(makeFinding({
        ruleId: 'ux.visual-control-missing-label',
        category: 'visual',
        severity: 'warning',
        message: `Control ${control.controlId} has no visible label.`,
        affected: { controlIds: [control.controlId] },
        remediation: 'Set a non-empty label for this control.'
      }));
    }
    if ((control.riskLevel === 'destructive' || control.riskLevel === 'critical') && !control.meta.helpText) {
      findings.push(makeFinding({
        ruleId: 'ux.visual-destructive-control-not-distinguished',
        category: 'visual',
        severity: 'suggestion',
        message: `Control "${control.label}" (${control.controlId}) is marked "${control.riskLevel}" but has no help text distinguishing it from a safe control.`,
        affected: { controlIds: [control.controlId] },
        remediation: 'Set controls[id].helpText, or otherwise ensure the operator cannot confuse this with a harmless control.'
      }));
    }
  }

  return findings;
}
