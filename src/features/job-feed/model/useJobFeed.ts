import { useCallback, useEffect, useRef, useState } from 'react';
import { jobsApi, type JobSearchItem, type JobSearchParams } from '@/entities/job';
import { emptyPage, errorMessageFrom, ApiError, pageFromUrl, type Paginated } from '@/shared/api';

export const FEED_PAGE_SIZE = 20;

interface FeedState {
  page: Paginated<JobSearchItem>;
  loading: boolean;
  error: string | null;
  /** true once at least one request has settled. */
  settled: boolean;
}

/** Loads `/jobs/search/` for the given params; re-runs whenever they change. */
export function useJobFeed(params: JobSearchParams) {
  const [state, setState] = useState<FeedState>({ page: emptyPage<JobSearchItem>(), loading: true, error: null, settled: false });
  const [tick, setTick] = useState(0);
  const key = JSON.stringify(params);
  const reqId = useRef(0);

  useEffect(() => {
    const id = ++reqId.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    jobsApi
      .searchJobs({ page_size: FEED_PAGE_SIZE, ...params })
      .then((page) => {
        if (id !== reqId.current) return;
        setState({ page, loading: false, error: null, settled: true });
      })
      .catch((e: unknown) => {
        if (id !== reqId.current) return;
        const msg = e instanceof ApiError ? errorMessageFrom(e.payload, e.message) : 'could not load jobs. check your connection and retry.';
        setState((s) => ({ ...s, loading: false, error: msg, settled: true }));
      });
    return () => {
      // a newer request supersedes this one
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  const retry = useCallback(() => setTick((n) => n + 1), []);

  const { page } = state;
  const currentPage = params.page ?? 1;
  const totalPages = Math.max(1, Math.ceil(page.count / FEED_PAGE_SIZE));
  const nextPage = page.next ? pageFromUrl(page.next) : null;
  const prevPage = page.previous ? pageFromUrl(page.previous) ?? (currentPage > 1 ? currentPage - 1 : null) : null;

  return { ...state, retry, currentPage, totalPages, nextPage, prevPage };
}
