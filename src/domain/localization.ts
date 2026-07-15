export type LanguageCode = 'en' | 'ru' | 'zh';

export interface LocalizedText {
  en: string;
  ru: string;
  zh?: string;
}

export type SupportedModelId =
  | 'Universal-LCD-128x64';
