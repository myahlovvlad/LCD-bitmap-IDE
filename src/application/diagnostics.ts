export type CommandDiagnosticSeverity = 'error' | 'warning' | 'info';

export interface CommandDiagnostic {
  severity: CommandDiagnosticSeverity;
  code: string;
  message: string;
  commandId?: string;
  issueId?: string;
}
