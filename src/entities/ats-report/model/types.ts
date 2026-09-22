import type { ApplicationStatus } from '@/shared/api';

/** GET /api/v1/ats/b2b-posted-jobs/ row (spec §4.2). */
export interface PostedJob {
  id: string;
  title: string;
  slug: string;
  /** applicant avatar urls */
  images: (string | null)[];
  /** e.g. "3+ Applied Candidates" — rendered verbatim, never re-derived */
  text: string;
}

/** GET /api/v1/ats/application/job-pipeline/ row — per-job counts across every ApplicationStatus. */
export type PipelineRow = { jobTitle: string } & Partial<Record<ApplicationStatus, number>>;

/** GET /api/v1/ats/application/hiring-efficiency/ row. */
export interface EfficiencyRow {
  job_id: string;
  job_title: string;
  total_applied: number;
  total_hired: number;
  hiring_efficiency_in_percentage: number | null;
  first_application_date: string | null;
  first_offer_accepted_date: string | null;
  time_to_hire_in_days: number | null;
  time_to_fill_in_days: number | null;
}

/** GET /api/v1/ats/application/hiring-data/ — shape not itemized in the spec; treated as unknown. */
export type HiringData = unknown;

export type InsightType = 'trends' | 'salaries' | 'titles' | 'roles';
