import { create } from 'zustand';
import { defaultJobSearchParams, type JobSearchParams } from '@/entities/job';

/**
 * The one set of `/jobs/search/` params the feed renders. Other features
 * (saved searches, onboarding) write here; the jobs page reads from here.
 * Not persisted: a fresh visit starts from the seeker's onboarding prefs.
 */
interface ActiveJobParamsState {
  params: JobSearchParams;
  /** true once onboarding prefs were used to seed `params` (one-shot). */
  seededFromPrefs: boolean;
  setParams: (next: JobSearchParams) => void;
  /** Shallow-merge a patch; any key change other than `page` resets to page 1. */
  patchParams: (patch: Partial<JobSearchParams>) => void;
  markSeeded: () => void;
  reset: () => void;
}

export const useActiveJobParams = create<ActiveJobParamsState>((set) => ({
  params: defaultJobSearchParams(),
  seededFromPrefs: false,
  setParams: (next) => set({ params: next }),
  patchParams: (patch) =>
    set((s) => {
      const keys = Object.keys(patch);
      const onlyPage = keys.length === 1 && keys[0] === 'page';
      return { params: { ...s.params, ...(onlyPage ? null : { page: 1 }), ...patch } };
    }),
  markSeeded: () => set({ seededFromPrefs: true }),
  reset: () => set({ params: defaultJobSearchParams(), seededFromPrefs: true }),
}));

/** Stat-pill periods (design "all time / past month / past week / past 24h"). */
export type DatePreset = 'any' | 'month' | 'week' | 'day';
export const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'any', label: 'all time' },
  { key: 'month', label: 'past month' },
  { key: 'week', label: 'past week' },
  { key: 'day', label: 'past 24h' },
];

/**
 * `date_posted` is a gte filter that accepts an ISO date (spec §2.3). Dates
 * only (no time) so a DateFilter and a DateTimeFilter both accept the value.
 */
export function datePresetThreshold(key: DatePreset, now: Date = new Date()): string | undefined {
  const days: Record<DatePreset, number | null> = { any: null, month: 30, week: 7, day: 1 };
  const d = days[key];
  if (d == null) return undefined;
  const at = new Date(now.getTime() - d * 86400000);
  return at.toISOString().slice(0, 10);
}

/** Which preset (if any) the current `date_posted` value corresponds to. */
export function activeDatePreset(params: JobSearchParams, now: Date = new Date()): DatePreset | null {
  if (!params.date_posted) return 'any';
  for (const p of DATE_PRESETS) {
    if (p.key !== 'any' && datePresetThreshold(p.key, now) === params.date_posted) return p.key;
  }
  return null;
}

/** Count of user-set filters (everything except paging and the free-text query). */
export function activeFilterCount(params: JobSearchParams): number {
  let n = 0;
  for (const [k, v] of Object.entries(params)) {
    if (k === 'page' || k === 'page_size' || k === 'q') continue;
    if (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== '') n += 1;
  }
  return n;
}
