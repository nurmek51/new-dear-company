import type { ApplicationStatus } from '@/shared/api';

/** Row of GET /api/v1/ats/job/{id}/applicants/ (spec §4.2). `job_tite` is the backend's own typo. */
export interface Applicant {
  id: string;
  profile_id: string;
  name: string;
  email: string | null;
  job_tite: string | null;
  profile_picture: string | null;
  current_job_status: string | null;
  resume_used: string | null;
  cover_letter_used: string | null;
  /** live-computed 0–100 */
  match_score: number | null;
  match_score_obj: MatchScoreObj | null;
  status: ApplicationStatus | string;
  applied_at: string;
}

/** Match-engine breakdown (spec §5) — every field optional, the backend shape is not guaranteed. */
export interface MatchScoreObj {
  score?: number;
  overall_match_percent?: number;
  blocked?: boolean;
  block_reasons?: string[];
  top_strengths?: { criterion: string; why: string }[];
  top_gaps?: { criterion: string; why: string }[];
  skill_matches?: string[];
  skill_gaps?: string[];
  breakdown?: Record<string, { score: number; weight: number; contribution: number }>;
}

/** Status-count summary merged into the applicants response (spec §4.2). */
export type ApplicantSummary = Partial<Record<ApplicationStatus, number>> & { total_applicants: number };

export interface ApplicantsPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: Applicant[];
  summary: ApplicantSummary;
}

export interface ListApplicantsParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: ApplicationStatus | string;
}

/** Statuses a recruiter may set (spec §4.2: cannot set `withdrawn`). */
export type RecruiterStatus = Exclude<ApplicationStatus, 'withdrawn'>;

export interface RecruiterStatusUpdate {
  status: RecruiterStatus;
  notes?: string;
  action?: string;
}

/** Row of GET /api/v1/ats/applications/{id}/b2b-tracking/ (spec §4.2). */
export interface B2BTrackingRow {
  id: string;
  application: string;
  status: ApplicationStatus | string;
  notes: string | null;
  action: string | null;
  actor: string | null;
  actor_name: string | null;
  created_at: string;
}

export interface TrackingPatch {
  notes?: string;
  action?: string;
  status?: RecruiterStatus;
}
