import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Local-only coach-mark state — client UX, no backend involvement. */
interface TipsState {
  tipsSeen: Record<string, boolean>;
  markTipSeen: (screen: string) => void;
  restartTips: () => void;
}

export const useTipsStore = create<TipsState>()(
  persist(
    (set) => ({
      tipsSeen: {},
      markTipSeen: (screen) => set((s) => ({ tipsSeen: { ...s.tipsSeen, [screen]: true } })),
      restartTips: () => set({ tipsSeen: {} }),
    }),
    { name: 'dc-tips', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
