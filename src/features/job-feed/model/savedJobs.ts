import { create } from 'zustand';
import { jobsApi, type SavedJob } from '@/entities/job';

function jobIdOf(row: SavedJob): string | null {
  if (typeof row.job === 'string') return row.job;
  if (row.job && typeof row.job === 'object' && typeof row.job.id === 'string') return row.job.id;
  return null;
}

/**
 * Saved-job bookmarks (spec §2.7) as a set of job ids, loaded once per
 * signed-in session. Writes go through the toggle action, so the heart never
 * depends on the saved-row id and stays correct if the list drifts.
 */
interface SavedJobsState {
  savedJobIds: Record<string, true>;
  loaded: boolean;
  loading: boolean;
  pending: Record<string, true>;
  error: string | null;

  isSaved: (jobId: string) => boolean;
  isPending: (jobId: string) => boolean;
  load: (force?: boolean) => Promise<void>;
  toggle: (jobId: string) => Promise<void>;
  clear: () => void;
}

export const useSavedJobs = create<SavedJobsState>((set, get) => ({
  savedJobIds: {},
  loaded: false,
  loading: false,
  pending: {},
  error: null,

  isSaved: (jobId) => get().savedJobIds[jobId] === true,
  isPending: (jobId) => get().pending[jobId] === true,

  load: async (force = false) => {
    const s = get();
    if (s.loading || (s.loaded && !force)) return;
    set({ loading: true, error: null });
    try {
      const page = await jobsApi.listSavedJobs();
      const savedJobIds: Record<string, true> = {};
      for (const row of page.results) {
        const id = jobIdOf(row);
        if (id) savedJobIds[id] = true;
      }
      set({ savedJobIds, loaded: true, loading: false });
    } catch {
      set({ loading: false, loaded: true, error: 'could not load your saved jobs.' });
    }
  },

  toggle: async (jobId) => {
    if (get().pending[jobId]) return;
    set({ pending: { ...get().pending, [jobId]: true }, error: null });
    try {
      const result = await jobsApi.toggleSavedJob(jobId);
      const next = { ...get().savedJobIds };
      if (result === 'saved') next[jobId] = true;
      else delete next[jobId];
      set({ savedJobIds: next });
    } catch {
      set({ error: 'could not update your saved jobs. try again.' });
    } finally {
      const { [jobId]: _pending, ...rest } = get().pending;
      set({ pending: rest });
    }
  },

  clear: () => set({ savedJobIds: {}, loaded: false, loading: false, pending: {}, error: null }),
}));
