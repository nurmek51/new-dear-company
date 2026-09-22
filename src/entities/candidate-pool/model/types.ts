/**
 * Public candidate pool (spec §4.3, §11.9). These endpoints are AllowAny and
 * expose PII — treat everything here as public data and never cache it.
 * Field-level shapes are not itemized in the spec, so every field is optional
 * and rows are normalized from `unknown`.
 */
export interface PoolCandidate {
  id: string;
  /** profile id used by candidate-profile-by-profile-id (same as `id` unless the row nests a user). */
  profile_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  profile_picture: string | null;
  heading: string | null;
  department: string | null;
  address: string | null;
  skills: string[];
  looking_for_designations: string[];
  years_of_experience: number | null;
  expected_salary_min: number | null;
  expected_salary_max: number | null;
  salary_currency: string | null;
  created_at: string | null;
}

export interface CandidateDoc {
  id: string;
  title: string;
  file: string | null;
}

export interface CandidateExperience {
  title: string | null;
  company: string | null;
  start: string | null;
  end: string | null;
  description: string | null;
}

export interface CandidateEducation {
  degree: string | null;
  institution: string | null;
  start: string | null;
  end: string | null;
}

/** Full B2CProfile (spec §4.3) — normalized, optional-everything. */
export interface CandidateProfile extends PoolCandidate {
  bio: string | null;
  english_level: string | null;
  languages: string[];
  certifications: string[];
  resume_docs: CandidateDoc[];
  cover_letter_docs: CandidateDoc[];
  completion_percentage: number | null;
  work_experiences: CandidateExperience[];
  educations: CandidateEducation[];
}

export type CandidateOrdering = 'years_of_experience' | '-years_of_experience' | 'created_at' | '-created_at';

export interface ListCandidatesParams {
  page?: number;
  page_size?: number;
  search?: string;
  ordering?: CandidateOrdering;
  address?: string;
  skills?: string;
  department?: string;
  heading?: string;
  looking_for_designations?: string;
  years_of_experience?: number;
  years_of_experience__gte?: number;
  years_of_experience__lte?: number;
  expected_salary_min?: number;
  expected_salary_max?: number;
}

/** Row of GET /api/v1/ai-match-engine/match-profiles/{job_id}/ (spec §5) — normalized. */
export interface ProfileMatch {
  profile_id: string;
  name: string | null;
  heading: string | null;
  score: number | null;
  skill_matches: string[];
  skill_gaps: string[];
  top_strengths: { criterion: string; why: string }[];
  top_gaps: { criterion: string; why: string }[];
}
