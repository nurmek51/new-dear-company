import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Local-only onboarding completion flag — preference capture, no backend. */
interface OnboardingFlags {
  onboarded: boolean;
  hydrated: boolean;
  finishOnboarding: () => void;
  resetOnboarding: () => void;
}

export const useOnboardingFlags = create<OnboardingFlags>()(
  persist(
    (set) => ({
      onboarded: false,
      hydrated: false,
      finishOnboarding: () => set({ onboarded: true }),
      resetOnboarding: () => set({ onboarded: false }),
    }),
    {
      name: 'dc-onboarded',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state && useOnboardingFlags.setState({ hydrated: true });
      },
      partialize: ({ hydrated: _h, ...rest }) => rest,
    },
  ),
);
