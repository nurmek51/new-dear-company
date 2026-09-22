import { request, toPage, type Paginated } from '@/shared/api';
import type { JobSearchItem } from '../model/types';

/**
 * Endpoints outside `/api/v1/jobs/` that the job feed uses. Kept apart from
 * jobsApi so the CRUD module stays untouched.
 */

/** Payload of GET /api/v1/pages/job-page/ (spec §8). */
interface JobPagePayload {
  id?: number | string;
  title?: string;
  job_suggested_search?: unknown;
}

/**
 * GET /api/v1/pages/job-page/ → `job_suggested_search` chips for the search
 * bar. Any failure → empty list (the chips are decorative; the page hides the
 * row when it is empty).
 */
export async function getJobPageSuggestedSearches(): Promise<string[]> {
  try {
    const page = await request<JobPagePayload>('/api/v1/pages/job-page/', { anonymous: true });
    const raw = page.job_suggested_search;
    if (!Array.isArray(raw)) return [];
    return raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  } catch {
    return [];
  }
}

/**
 * GET /api/v1/ai-match-engine/ai-search-jobs/?q=&n=&use_llm= (spec §5) —
 * semantic job search. The spec does not itemize the row shape; the search
 * endpoint's flat row (§2.3) is the documented job list shape, so rows are
 * narrowed to that and anything else is dropped.
 */
export async function aiSearchJobs(q: string, n = 10, useLlm = true): Promise<JobSearchItem[]> {
  const res = await request<Paginated<unknown> | unknown[]>('/api/v1/ai-match-engine/ai-search-jobs/', {
    anonymous: true,
    query: { q, n, use_llm: useLlm },
  });
  return toPage<unknown>(res).results.filter(isSearchItem);
}

function isSearchItem(x: unknown): x is JobSearchItem {
  if (!x || typeof x !== 'object') return false;
  const r = x as Record<string, unknown>;
  return typeof r.id === 'string' && typeof r.designation === 'string' && typeof r.company === 'string';
}
