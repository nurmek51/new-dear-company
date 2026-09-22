import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessageFrom, pageFromUrl, type Paginated } from '@/shared/api';

export function apiMessage(err: unknown): string {
  const e = err as { payload?: unknown; message?: string };
  return errorMessageFrom(e?.payload, e?.message ?? 'something went wrong. please try again.');
}

/** Page-number list over a DRF envelope (spec §0.2): load page 1, "load more" appends the next page. */
export function usePagedList<T extends { id: string }>(fetchPage: (page: number) => Promise<Paginated<T>>) {
  const [rows, setRows] = useState<T[]>([]);
  const [count, setCount] = useState(0);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchPage(1);
      if (!alive.current) return;
      setRows(page.results);
      setCount(page.count);
      setNextPage(pageFromUrl(page.next));
    } catch (err) {
      if (alive.current) setError(apiMessage(err));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (nextPage == null || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(nextPage);
      if (!alive.current) return;
      setRows((r) => [...r, ...page.results.filter((x) => !r.some((y) => y.id === x.id))]);
      setCount(page.count);
      setNextPage(pageFromUrl(page.next));
    } catch (err) {
      if (alive.current) setError(apiMessage(err));
    } finally {
      if (alive.current) setLoadingMore(false);
    }
  }, [fetchPage, nextPage, loadingMore]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { rows, setRows, count, nextPage, loading, loadingMore, error, reload, loadMore };
}
