import { request, toPage, type AsyncTaskTicket, type Paginated } from '@/shared/api';
import type {
  CoverLetterDocument,
  RecommendationsResponse,
  Resume,
  ResumeDocument,
  ResumeUploadResult,
} from '../model/types';

/** Uploads and AI ticket POSTs run far past the default request timeout. */
const LONG_TIMEOUT_MS = 120_000;

/** GET /api/v1/resumes/ (spec §3.1) — the caller's own resumes. */
export async function listResumes(page = 1): Promise<Paginated<Resume>> {
  const res = await request<Paginated<Resume> | Resume[]>('/api/v1/resumes/', { query: { page } });
  return toPage(res);
}

/**
 * POST /api/v1/resumes/ (spec §3.1) — multipart `file` + `parsing_enabled`.
 * Parsing (when enabled) is async: subscribe to `event_url` for the status.
 */
export async function uploadResume(form: FormData, parsingEnabled: boolean): Promise<ResumeUploadResult> {
  form.append('parsing_enabled', parsingEnabled ? 'true' : 'false');
  return request<ResumeUploadResult>('/api/v1/resumes/', { method: 'POST', form, timeoutMs: LONG_TIMEOUT_MS });
}

/** DELETE /api/v1/resumes/{id}/ (spec §3.1). */
export async function deleteResume(id: string): Promise<void> {
  await request<unknown>(`/api/v1/resumes/${id}/`, { method: 'DELETE' });
}

/** POST /api/v1/resumes/set-resume-selected/{id}/ (spec §3.5). */
export async function setResumeSelected(id: string): Promise<void> {
  await request<{ message: string }>(`/api/v1/resumes/set-resume-selected/${id}/`, { method: 'POST' });
}

/** GET /api/v1/resumes/selected-resume-cover-letter/ (spec §3.5). */
export async function getSelectedDocs(): Promise<{ resume: ResumeDocument | null; cover_letter: CoverLetterDocument | null }> {
  return request('/api/v1/resumes/selected-resume-cover-letter/');
}

/**
 * POST /api/v1/resumes/assessment/ (spec §3.3) — pass a stored resume id or a
 * multipart `resume_file`. Result arrives on `ai_resume_assessment_<task_id>`.
 */
export async function assessResume(input: { resume_id: string } | { form: FormData }): Promise<AsyncTaskTicket> {
  if ('form' in input) {
    return request<AsyncTaskTicket>('/api/v1/resumes/assessment/', {
      method: 'POST',
      form: input.form,
      timeoutMs: LONG_TIMEOUT_MS,
    });
  }
  return request<AsyncTaskTicket>('/api/v1/resumes/assessment/', {
    method: 'POST',
    body: { resume_id: input.resume_id },
    timeoutMs: LONG_TIMEOUT_MS,
  });
}

/** GET /api/v1/resumes/recommendations/{job_id}/{resume_id}/ (spec §3.4). */
export async function recommendations(jobId: string, resumeId: string): Promise<RecommendationsResponse> {
  return request<RecommendationsResponse>(`/api/v1/resumes/recommendations/${jobId}/${resumeId}/`, {
    timeoutMs: LONG_TIMEOUT_MS,
  });
}

/** POST /api/v1/resumes/ai-resume-generation/ (spec §3.6) — creates a new Resume once done. */
export async function aiGenerateResume(jobId: string): Promise<AsyncTaskTicket> {
  return request<AsyncTaskTicket>('/api/v1/resumes/ai-resume-generation/', {
    method: 'POST',
    body: { job_id: jobId },
    timeoutMs: LONG_TIMEOUT_MS,
  });
}
