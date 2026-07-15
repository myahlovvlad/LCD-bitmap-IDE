export type CompilerDiagnosticSeverity = 'error' | 'warning' | 'info';

export type CompilerDiagnosticCode =
  | 'compiler.source.display-unsupported'
  | 'compiler.source.screen-missing'
  | 'compiler.source.state-missing'
  | 'compiler.source.transition-endpoint-missing'
  | 'compiler.source.event-missing'
  | 'compiler.source.symbol-collision'
  | 'compiler.source.resource-too-large';

export interface CompilerDiagnostic {
  code: CompilerDiagnosticCode;
  severity: CompilerDiagnosticSeverity;
  message: string;
  entityType?: string;
  entityId?: string;
  path?: string;
}

export function compilerDiagnostic(
  code: CompilerDiagnosticCode,
  severity: CompilerDiagnosticSeverity,
  message: string,
  details: Omit<CompilerDiagnostic, 'code' | 'severity' | 'message'> = {}
): CompilerDiagnostic {
  return { code, severity, message, ...details };
}
