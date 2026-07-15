import type { LocalizedText } from './localization';
import type { ValueExpression } from './tag';

export type AlarmSeverity = 'info' | 'warning' | 'critical';

export interface AlarmDefinition {
  id: string;
  name: LocalizedText;
  severity: AlarmSeverity;
  condition: ValueExpression;
  message: LocalizedText;
  autoAcknowledge?: boolean;
}
