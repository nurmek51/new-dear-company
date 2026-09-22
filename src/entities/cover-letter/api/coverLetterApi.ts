import { request, toPage, type AsyncTaskTicket, type Paginated } from '@/shared/api';
import type { CoverLetter } from '../model/types';

/** Uploads and AI ticket POSTs run far past the default request timeout. */
const LONG_TIMEOUT_MS = 120_000;

/** GET /api/v1/cover-letters/ (spec §3.7). */
export async function listCoverLetters(page = 1): Promise<Paginated<CoverLetter>> {
  const res = await request<Paginated<CoverLetter> | CoverLetter[]>('/api/v1/cover-letters/', { query: { page } });
  return toPage(res);
}

/**
 * POST /api/v1/cover-letters/ (spec §3.7) — multipart `file` + `title` (+ optional `job`).
 * The backend does not validate the file; the caller validates before building the form.
 */
export async function createCoverLetter(form: FormData, title: string, jobId?: string): Promise<CoverLetter> {
  form.append('title', title);
  if (jobId) form.append('job', jobId);
  return request<CoverLetter>('/api/v1/cover-letters/', { method: 'POST', form, timeoutMs: LONG_TIMEOUT_MS });
}

/** DELETE /api/v1/cover-letters/{id}/ (spec §3.7). */
export async function deleteCoverLetter(id: string): Promise<void> {
  await request<unknown>(`/api/v1/cover-letters/${id}/`, { method: 'DELETE' });
}

/** POST /api/v1/resumes/set-cover-letter-selected/{id}/ (spec §3.5). */
export async function setCoverLetterSelected(id: string): Promise<void> {
  await request<{ message: string }>(`/api/v1/resumes/set-cover-letter-selected/${id}/`, { method: 'POST' });
}

/** POST /api/v1/cover-letters/ai-cover-letter-generation/ (spec §3.8) — async, creates a CoverLetter once done. */
export async function aiGenerateCoverLetter(jobId: string): Promise<AsyncTaskTicket> {
  return request<AsyncTaskTicket>('/api/v1/cover-letters/ai-cover-letter-generation/', {
    method: 'POST',
    body: { job_id: jobId },
    timeoutMs: LONG_TIMEOUT_MS,
  });
}
