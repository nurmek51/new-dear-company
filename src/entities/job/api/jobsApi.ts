import { emptyPage, request, toPage, type AsyncTaskTicket, type Paginated } from '@/shared/api';
import type {
  Job,
  JobFiltersList,
  JobSearchItem,
  JobSearchParams,
  JobWriteInput,
  SavedJob,
  SearchQuery,
} from '../model/types';

const PAGE_SIZE = 20;
/** AI ticket POSTs and file uploads run far past the default request timeout. */
const AI_TIMEOUT_MS = 120_000;

/** GET /api/v1/jobs/search/ (spec §2.3) — public, paginated. */
export async function searchJobs(params: JobSearchParams): Promise<Paginated<JobSearchItem>> {
  const res = await request<Paginated<JobSearchItem> | JobSearchItem[]>('/api/v1/jobs/search/', {
    anonymous: true,
    query: { page_size: PAGE_SIZE, ...params },
  });
  return toPage(res);
}

/** GET /api/v1/jobs/{id}/ (spec §2.2) — public; null on 404. */
export async function getJob(id: string): Promise<Job | null> {
  try {
    return await request<Job>(`/api/v1/jobs/${id}/`);
  } catch (e) {
    if ((e as { status?: number }).status === 404) return null;
    throw e;
  }
}

/** GET /api/v1/jobs/filters-list/ (spec §2.4). */
export async function getFiltersList(types?: string[]): Promise<JobFiltersList> {
  const response = await request<Record<string, unknown>>('/api/v1/jobs/filters-list/', {
    anonymous: true,
    query: types ? { type: types } : undefined,
  });
  return normalizeFiltersList(response);
}

/**
 * The live API returns filter choices as `{ value, label }[]` and uses model
 * field names for a few groups. Keep that transport detail at the API boundary
 * so search params and the filter UI consistently work with string values.
 */
function normalizeFiltersList(response: Record<string, unknown>): JobFiltersList {
  const values = (key: string): string[] => {
    const options = response[key];
    if (!Array.isArray(options)) return [];
    return options.flatMap((option) => {
      if (typeof option === 'string') return [option];
      if (option && typeof option === 'object' && typeof (option as { value?: unknown }).value === 'string') {
        return [(option as { value: string }).value];
      }
      return [];
    });
  };

  return {
    skills: values('skills'),
    specializations: values('specializations'),
    grades: values('grades'),
    employment_types: values('employment_types').length ? values('employment_types') : values('work_types'),
    work_formats: values('work_formats'),
    english_levels: values('english_levels'),
    languages: values('languages').length ? values('languages') : values('vacancy_languages'),
    company_types: values('company_types'),
    company_domains: values('company_domains'),
    currencies: values('currencies').length ? values('currencies') : values('currency'),
    countries: values('countries'),
    sources: values('sources'),
  };
}

/** POST /api/v1/jobs/ (spec §2.2, B2B). */
export async function createJob(input: JobWriteInput): Promise<Job> {
  return request<Job>('/api/v1/jobs/', { method: 'POST', body: input });
}

/** PATCH /api/v1/jobs/{id}/ (spec §2.2, B2B). */
export async function updateJob(id: string, patch: Partial<JobWriteInput>): Promise<Job> {
  return request<Job>(`/api/v1/jobs/${id}/`, { method: 'PATCH', body: patch });
}

/** DELETE /api/v1/jobs/{id}/ (spec §2.2, B2B). */
export async function deleteJob(id: string): Promise<void> {
  await request(`/api/v1/jobs/${id}/`, { method: 'DELETE' });
}

/** POST /api/v1/jobs/ai-job-creation/ (spec §2.6) → async ticket. */
export async function aiCreateJob(user_prompt: string): Promise<AsyncTaskTicket> {
  return request<AsyncTaskTicket>('/api/v1/jobs/ai-job-creation/', {
    method: 'POST',
    body: { user_prompt },
    timeoutMs: AI_TIMEOUT_MS,
  });
}

/** POST /api/v1/jobs/ai-job-creation-from-file/ (spec §2.6), multipart `file`. */
export async function aiCreateJobFromFile(form: FormData): Promise<AsyncTaskTicket> {
  return request<AsyncTaskTicket>('/api/v1/jobs/ai-job-creation-from-file/', {
    method: 'POST',
    form,
    timeoutMs: AI_TIMEOUT_MS,
  });
}

/* ---------- saved jobs (spec §2.7) ---------- */

export async function listSavedJobs(): Promise<Paginated<SavedJob>> {
  const res = await request<Paginated<SavedJob> | SavedJob[]>('/api/v1/jobs/saved-jobs/');
  return toPage(res);
}

/**
 * POST /api/v1/jobs/saved-jobs/toggle/ — saves or unsaves in one call and is
 * the only reliable write: the plain create action answers 201 even when the
 * job is already saved or missing, without returning the row.
 */
export async function toggleSavedJob(jobId: string): Promise<'saved' | 'unsaved'> {
  const res = await request<{ detail?: string }>('/api/v1/jobs/saved-jobs/toggle/', {
    method: 'POST',
    body: { job: jobId },
  });
  return /unsaved/i.test(res?.detail ?? '') ? 'unsaved' : 'saved';
}

/** DELETE takes the saved-row id, not the job id. */
export async function unsaveJob(savedId: string | number): Promise<void> {
  await request(`/api/v1/jobs/saved-jobs/${savedId}/`, { method: 'DELETE' });
}

/* ---------- search history / saved searches (spec §2.8) ---------- */

export async function listSearchQueries(search_type?: SearchQuery['search_type']): Promise<SearchQuery[]> {
  const res = await request<Paginated<SearchQuery> | SearchQuery[]>('/api/v1/jobs/search-queries/', {
    query: { search_type },
  });
  return toPage(res).results;
}

export async function createSearchQuery(input: Omit<SearchQuery, 'id' | 'created_at'>): Promise<SearchQuery> {
  return request<SearchQuery>('/api/v1/jobs/search-queries/', { method: 'POST', body: input });
}

export async function deleteSearchQuery(id: string | number): Promise<void> {
  await request(`/api/v1/jobs/search-queries/${id}/`, { method: 'DELETE' });
}

/* ---------- AI match engine (spec §5) ---------- */
export async function similarJobs(jobId: string, n = 6): Promise<JobSearchItem[]> {
  const res = await request<Paginated<JobSearchItem> | JobSearchItem[]>(
    `/api/v1/ai-match-engine/similar-jobs/${jobId}/`,
    { anonymous: true, query: { n } },
  );
  return toPage(res).results;
}

export interface MatchResult {
  job_id: string;
  profile_id: string;
  blocked: boolean;
  block_reasons: string[];
  department_match: boolean;
  overall_match_percent: number;
  score: number;
  breakdown: Record<string, { score: number; weight: number; contribution: number }>;
  top_strengths: { criterion: string; why: string }[];
  top_gaps: { criterion: string; why: string }[];
  skill_matches: string[];
  skill_gaps: string[];
}

/** GET /api/v1/ai-match-engine/match-score/{job_id}/ (B2C, own profile). */
export async function myMatchScore(jobId: string): Promise<MatchResult> {
  return request<MatchResult>(`/api/v1/ai-match-engine/match-score/${jobId}/`);
}

export const emptyJobPage = () => emptyPage<JobSearchItem>();
