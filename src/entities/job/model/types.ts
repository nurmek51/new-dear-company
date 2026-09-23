import type { EmploymentType, EnglishLevel, Grade, SalaryUnit, WorkFormat } from '@/shared/api';

/** Organization nested in a Job (spec §2.1). */
export interface JobOrganization {
  id: string;
  name: string;
  url: string | null;
  url_domain: string | null;
  logo: string | null;
  logo_display: string | null;
  size: string | null;
  industry: string | null;
  type: string | null;
  headquarters: string | null;
  description: string | null;
  is_verified: boolean;
}

export interface JobSalary {
  id?: string;
  currency: string;
  min_value: number | null;
  max_value: number | null;
  unit_text: SalaryUnit | string;
}

export interface JobLocation {
  id?: string;
  country: string | null;
  region: string | null;
  locality: string | null;
  street_address: string | null;
  postal_code: string | null;
  timezone: string | null;
  country_iso?: string | null;
}

/** Full Job object from CRUD/retrieve endpoints (spec §2.1). */
export interface Job {
  id: string;
  title: string;
  department: string | null;
  description_text: string;
  description_html: string | null;
  responsibilities: string | null;
  employment_type: EmploymentType | string;
  remote_option: boolean;
  skills_required: string[];
  experience_required: number | null;
  qualifications: string[];
  highlights: string[];
  auto_screening_questions: string[];
  date_posted: string | null;
  date_validthrough: string | null;
  job_url: string | null;
  source: string;
  source_type: string | null;
  source_domain: string | null;
  organization: JobOrganization | null;
  salary: JobSalary | null;
  job_locations: JobLocation[];
  published_at: string | null;
  english_level: EnglishLevel | null;
  vacancy_languages: string | null;
  work_format: WorkFormat | string | null;
  grade: Grade | string | null;
  geo_regions: string[];
  relocation_countries: string[];
  specializations: string[];
  certifications: string[];
  is_authorization_needed_to_work: boolean;
  /** Only on retrieve; true for an authenticated B2B user of the job's org. */
  show_profile_matches?: boolean;
}

/** Flat shape returned by GET /api/v1/jobs/search/ (spec §2.3). */
export interface JobSearchItem {
  id: string;
  slug: string;
  compImage: string | null;
  company: string;
  designation: string;
  salary: string;
  time: string;
  type: string;
  match: string | null;
  postedTime: string;
  deadline: string | null;
  job_locations: JobLocation[];
  source: string;
  grade: string | null;
  job_url: string | null;
}

/** Query params for /jobs/search/ (spec §2.3) — only server-backed filters. */
export interface JobSearchParams {
  q?: string;
  page?: number;
  page_size?: number;
  skills_required?: string[];
  specializations?: string[];
  geo_regions?: string[];
  relocation_countries?: string[];
  employment_type?: string[];
  work_format?: string[];
  english_level?: string[];
  vacancy_languages?: string[];
  grade?: string[];
  company_domains?: string[];
  company_types?: string[];
  currency?: string[];
  country?: string[];
  organization__name?: string;
  organization__industry?: string;
  organization__type?: string;
  salary__min_value?: number;
  salary__max_value?: number;
  /** ISO date; jobs posted on/after */
  date_posted?: string;
  experience_required?: number;
  source?: string;
}

export function defaultJobSearchParams(): JobSearchParams {
  return {};
}

/** Normalized string values from the filters-list transport response (spec §2.4). */
export interface JobFiltersList {
  skills?: string[];
  specializations?: string[];
  grades?: string[];
  employment_types?: string[];
  work_formats?: string[];
  english_levels?: string[];
  languages?: string[];
  company_types?: string[];
  company_domains?: string[];
  currencies?: string[];
  countries?: string[];
  sources?: string[];
  [key: string]: string[] | undefined;
}

/** Saved job row (spec §2.7) — shape not itemized; keep it loose but typed. */
/**
 * A saved-job row nests only a stub of the job — `{id,title,slug,text}` from
 * B2CSavedJobSerializer — so a card needs the full job fetched separately.
 */
export interface SavedJobRef {
  id: string;
  title?: string;
  slug?: string;
  text?: string;
}

export interface SavedJob {
  id: string | number;
  job: SavedJobRef | string;
  created_at?: string;
}

/** Search-history row (spec §2.8). */
export interface SearchQuery {
  id: string | number;
  search_type: 'url' | 'query' | 'preference';
  data: string;
  preference_data: Record<string, unknown> | null;
  source_page: string | null;
  created_at?: string;
}

/** Write payload for POST/PATCH /api/v1/jobs/ (recruiter). */
export interface JobWriteInput {
  title: string;
  department?: string;
  description_text: string;
  description_html?: string;
  responsibilities?: string;
  employment_type: EmploymentType | string;
  remote_option?: boolean;
  skills_required?: string[];
  experience_required?: number;
  qualifications?: string[];
  highlights?: string[];
  auto_screening_questions?: string[];
  date_validthrough?: string | null;
  job_url?: string | null;
  english_level?: EnglishLevel | null;
  vacancy_languages?: string | null;
  work_format?: WorkFormat | null;
  grade?: Grade | null;
  geo_regions?: string[];
  relocation_countries?: string[];
  specializations?: string[];
  published_at?: string | null;
  salary_id?: string;
  job_location_ids?: string[];
}
