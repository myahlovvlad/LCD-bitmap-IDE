import type { LocalizedText } from './localization';

export interface TrendDefinition {
  id: string;
  name: LocalizedText;
  tagIds: string[];
  retentionSamples?: number;
  sampleIntervalMs?: number;
}
