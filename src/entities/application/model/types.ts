import type { ApplicationStatus } from '@/shared/api';
import type { Job } from '@/entities/job';

/** ResumeDocument (spec §3.5). */
export interface ResumeDocument {
  id: string;
  file: string | null;
  title: string;
  is_selected: boolean;
  created_at: string;
}

/** CoverLetterDocument (spec §3.7). */
export interface CoverLetterDocument {
  id: string;
  title: string;
  file: string | null;
  is_selected: boolean;
  is_ai_generated: boolean;
  job: string | null;
  created_at: string;
  updated_at: string;
}

/** GET /api/v1/resumes/selected-resume-cover-letter/ (spec §3.5). */
export interface SelectedDocs {
  resume: ResumeDocument | null;
  cover_letter: CoverLetterDocument | null;
}

/** Row of GET /api/v1/ats/b2c-applied-jobs/ (spec §4.1). resume/cover_letter may be ids or nested docs. */
export interface JobSeekerApplication {
  id: string;
  user: string;
  job: Job;
  resume: string | ResumeDocument | null;
  cover_letter: string | CoverLetterDocument | null;
  status: ApplicationStatus;
  applied_at: string;
  withdrawn_count: number;
  auto_apply: boolean;
  is_active: boolean;
}

/** GET /api/v1/ats/jobs/{job_id}/status/ (spec §4.1). */
export interface JobApplicationStatus {
  is_applied: boolean;
  is_saved: boolean;
  withdrawn_count: number;
  application: { resume: ResumeDocument | null; cover_letter: CoverLetterDocument | null } | null;
}

/** GET /api/v1/ats/applications/{id}/b2c-tracking/ row (spec §4.1). */
export interface TrackingRow {
  id: string;
  application: string;
  status: ApplicationStatus | string;
  notes: string | null;
  action: string | null;
  created_at: string;
}

export interface ApplyInput {
  job: string;
  resume?: string;
  cover_letter?: string;
  auto_apply?: boolean;
}

/** Statuses a candidate may set (spec §4.1). */
export type CandidateStatusUpdate = 'offer-accepted' | 'offer-rejected' | 'withdrawn';

export interface ListApplicationsParams {
  page?: number;
  page_size?: number;
  /** ISO date filters on applied_at (spec §4.1). */
  applied_at__gte?: string;
  applied_at__lte?: string;
}
