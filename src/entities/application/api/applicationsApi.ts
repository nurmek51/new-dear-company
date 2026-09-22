import { request, toPage, type Paginated } from '@/shared/api';
import type {
  ApplyInput,
  CandidateStatusUpdate,
  CoverLetterDocument,
  JobApplicationStatus,
  JobSeekerApplication,
  ListApplicationsParams,
  SelectedDocs,
  TrackingRow,
} from '../model/types';

const PAGE_SIZE = 20;

/** POST /api/v1/ats/apply-job/ (spec §4.1) → `{detail}`. 400 detail explains inactive/already applied/2 withdrawals. */
export async function applyToJob(input: ApplyInput): Promise<{ detail: string }> {
  return request<{ detail: string }>('/api/v1/ats/apply-job/', {
    method: 'POST',
    body: { job: input.job, resume: input.resume, cover_letter: input.cover_letter, auto_apply: input.auto_apply ?? false },
  });
}

/** GET /api/v1/ats/jobs/{job_id}/status/ (spec §4.1). */
export async function getJobStatus(jobId: string): Promise<JobApplicationStatus> {
  return request<JobApplicationStatus>(`/api/v1/ats/jobs/${jobId}/status/`);
}

/** GET /api/v1/ats/b2c-applied-jobs/ (spec §4.1) — paginated, newest first. */
export async function listMyApplications(params: ListApplicationsParams = {}): Promise<Paginated<JobSeekerApplication>> {
  const res = await request<Paginated<JobSeekerApplication> | JobSeekerApplication[]>('/api/v1/ats/b2c-applied-jobs/', {
    query: { page_size: PAGE_SIZE, ...params },
  });
  return toPage(res);
}

/**
 * POST /api/v1/ats/applications/{id}/update-status-by-candidate/ (spec §4.1).
 * The backend restricts which transitions a candidate may make; `canTransition`
 * in `../model/stages` gates the UI before this is called.
 */
export async function updateStatusByCandidate(
  applicationId: string,
  input: { status: CandidateStatusUpdate; notes?: string },
): Promise<unknown> {
  return request(`/api/v1/ats/applications/${applicationId}/update-status-by-candidate/`, {
    method: 'POST',
    body: { status: input.status, notes: input.notes ?? '' },
  });
}

/** GET /api/v1/ats/applications/{id}/b2c-tracking/ (spec §4.1) — owner-only history log. */
export async function getMyTracking(applicationId: string): Promise<TrackingRow[]> {
  const res = await request<TrackingRow[] | Paginated<TrackingRow>>(`/api/v1/ats/applications/${applicationId}/b2c-tracking/`);
  return toPage(res).results;
}

/** GET /api/v1/resumes/selected-resume-cover-letter/ (spec §3.5) — read-only here. */
export async function getSelectedDocs(): Promise<SelectedDocs> {
  return request<SelectedDocs>('/api/v1/resumes/selected-resume-cover-letter/');
}

/** GET /api/v1/cover-letters/ (spec §3.7) — read-only here; creation lives in the resume domain. */
export async function listCoverLetters(): Promise<CoverLetterDocument[]> {
  const res = await request<CoverLetterDocument[] | Paginated<CoverLetterDocument>>('/api/v1/cover-letters/', {
    query: { page_size: 100 },
  });
  return toPage(res).results;
}
