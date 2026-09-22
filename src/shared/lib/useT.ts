import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { translate, type Lang } from '@/shared/i18n';

interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export const useLangStore = create<LangState>()(
  persist(
    (set) => ({
      lang: 'en',
      setLang: (lang) => set({ lang }),
    }),
    { name: 'dc-lang', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/** t('english source string') → translated string for the active language. */
export function useT() {
  const lang = useLangStore((s) => s.lang);
  return useCallback((key: string) => translate(key, lang), [lang]);
}

export function useIsRTL() {
  return useLangStore((s) => s.lang) === 'ar';
}
