import dict from './dict.json';

export type Lang = 'en' | 'ru' | 'es' | 'ar' | 'kk';

export const LANGS: { code: Lang; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'ru', name: 'Русский' },
  { code: 'es', name: 'Español' },
  { code: 'ar', name: 'العربية' },
  { code: 'kk', name: 'Қазақша' },
];

type Entry = Partial<Record<Exclude<Lang, 'en'>, string>>;
const D = dict as Record<string, Entry>;

/**
 * Translate an English source string (the dictionary key) into `lang`.
 * Falls back to the English source when no translation exists.
 */
export function translate(key: string, lang: Lang): string {
  if (lang === 'en') return key;
  const entry = D[key] ?? D[key.toLowerCase()];
  return entry?.[lang] ?? key;
}
