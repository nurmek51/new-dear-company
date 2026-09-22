import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Seeker preferences captured by /onboarding (local only — there is no
 * preferences endpoint). Values are the API enum strings so the jobs feed can
 * pre-fill `JobSearchParams` directly: `grades` ⊂ GRADES, `workFormat` ⊂
 * WORK_FORMATS, `specializations` are free-text role names.
 */
export interface SeekerPrefs {
  grades: string[];
  workFormat: string[];
  specializations: string[];
}

interface SeekerPrefsState extends SeekerPrefs {
  hydrated: boolean;
  set: (patch: Partial<SeekerPrefs>) => void;
  clear: () => void;
}

const empty: SeekerPrefs = { grades: [], workFormat: [], specializations: [] };

export const useSeekerPrefs = create<SeekerPrefsState>()(
  persist(
    (set) => ({
      ...empty,
      hydrated: false,
      set: (patch) => set(patch),
      clear: () => set({ ...empty }),
    }),
    {
      name: 'dc-seeker-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state && useSeekerPrefs.setState({ hydrated: true });
      },
      partialize: ({ grades, workFormat, specializations }) => ({ grades, workFormat, specializations }),
    },
  ),
);
