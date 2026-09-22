import { useEffect, useState } from 'react';
import { jobsApi, type JobSearchParams } from '@/entities/job';
import { DATE_PRESETS, datePresetThreshold, type DatePreset } from './activeParams';

export type JobStats = Partial<Record<DatePreset, number>>;

/** Params that influence the counts: everything except paging and the date itself. */
export function statsBaseParams(params: JobSearchParams): JobSearchParams {
  const { page: _p, page_size: _s, date_posted: _d, ...rest } = params;
  return rest;
}

const cache = new Map<string, JobStats>();
const inFlight = new Map<string, Promise<JobStats>>();

async function fetchStats(base: JobSearchParams): Promise<JobStats> {
  const now = new Date();
  const entries = await Promise.all(
    DATE_PRESETS.map(async (p) => {
      const date_posted = datePresetThreshold(p.key, now);
      try {
        const page = await jobsApi.searchJobs({ ...base, page_size: 1, page: 1, ...(date_posted ? { date_posted } : null) });
        return [p.key, page.count] as const;
      } catch {
        return [p.key, undefined] as const;
      }
    }),
  );
  const out: JobStats = {};
  for (const [k, v] of entries) if (v != null) out[k] = v;
  return out;
}

/** Only a complete answer is worth caching — a partial one retries on the next mount. */
const isComplete = (s: JobStats) => DATE_PRESETS.every((p) => s[p.key] != null);

/**
 * Real "openings" counts per period: four `/jobs/search/` calls (page_size 1)
 * with `date_posted` thresholds, cached per filter combination.
 */
export function useJobStats(params: JobSearchParams): { stats: JobStats; loading: boolean } {
  const base = statsBaseParams(params);
  const key = JSON.stringify(base);
  const [stats, setStats] = useState<JobStats>(() => cache.get(key) ?? {});
  const [loading, setLoading] = useState(!cache.has(key));

  useEffect(() => {
    let cancelled = false;
    const cached = cache.get(key);
    if (cached) {
      setStats(cached);
      setLoading(false);
      return;
    }
    setLoading(true);
    let p = inFlight.get(key);
    if (!p) {
      p = fetchStats(base)
        .then((s) => {
          if (isComplete(s)) cache.set(key, s);
          return s;
        })
        .catch((): JobStats => ({}))
        .finally(() => inFlight.delete(key));
      inFlight.set(key, p);
    }
    void p.then((s) => {
      if (cancelled) return;
      setStats(s);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { stats, loading };
}

/** Drop cached counts (e.g. after a recruiter publishes a job). */
export function clearJobStatsCache() {
  cache.clear();
}
