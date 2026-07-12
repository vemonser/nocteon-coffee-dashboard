

export const AvailableLangs = ['en', 'ar'];

export const AVAILABLE_LANGUAGES =  ['en', 'ar'] as const;

export type Language =
  (typeof AVAILABLE_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'en';

export const LANGUAGE_STORAGE_KEY = 'language';


export const SUPPORTED_LANGUAGES = [
    { code: 'en', label: 'English', dir: 'ltr' },
    { code: 'ar', label: 'عربي', dir: 'rtl' },
];
