import type { LocalizedText } from './localization';

export type ValueExpression =
  | { kind: 'literal'; value: string | number | boolean }
  | { kind: 'tag'; tagId: string }
  | { kind: 'formula'; expression: string; deps: string[] };

export interface HmiBindings {
  visibility?: ValueExpression;
  enabled?: ValueExpression;
  text?: ValueExpression;
  value?: ValueExpression;
  color?: ValueExpression;
  eventId?: string;
  writeTag?: { tagId: string; value: ValueExpression };
  /** Procedure launched by the FSM transition that activates this HMI object. */
  procedureId?: string;
  /** Traceable calculation/algorithm identifier shown in HMI hand-off. */
  algorithmId?: string;
}

export type HmiTagDataType = 'float' | 'int' | 'bool' | 'string';

export interface HmiTag {
  id: string;
  name: LocalizedText;
  dataType: HmiTagDataType;
  unit?: string;
  /** printf-compatible display format used by LCD preview and firmware handoff. */
  format?: string;
  sourceId?: string;
  address?: string;
  precision?: number;
  minValue?: number;
  maxValue?: number;
}

export type DataSourceKind = 'cli' | 'serial' | 'simulation' | 'formula';

export interface DataSource {
  id: string;
  kind: DataSourceKind;
  config: Record<string, unknown>;
}
