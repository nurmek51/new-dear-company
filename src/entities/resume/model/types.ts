/** Spec §3.1 — the Resume object returned by /api/v1/resumes/. */
export type ParsingStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'disabled' | string;

export interface Resume {
  id: string;
  file: string;
  title: string;
  ai_parsed_data: unknown;
  ai_suggestions: unknown;
  parsing_status: ParsingStatus;
  is_selected?: boolean;
  is_ai_generated?: boolean;
  created_at: string;
  updated_at?: string;
}

/** Spec §3.5 — the slimmer shape from selected-resume-cover-letter/. */
export interface ResumeDocument {
  id: string;
  file: string;
  title: string;
  is_selected: boolean;
  created_at: string;
}

export interface CoverLetterDocument {
  id: string;
  file: string;
  title: string;
  is_selected: boolean;
  created_at: string;
}

/** Spec §3.1 POST response. `task_id`/`event_url` only when parsing is enabled. */
export interface ResumeUploadResult {
  resume: Resume;
  task_id?: string;
  event_id?: string;
  event_url?: string;
  message?: string;
}

/** Spec §3.4 result payload on `ai_recommendation_<task_id>`. */
export interface JobRecommendations {
  job_fit_summary?: string;
  skills_to_improve?: string[];
  experience_gaps?: string[];
  resume_improvement_tips?: string[];
  application_advice?: string;
}

export type RecommendationsResponse =
  | { cached: true; recommendations: JobRecommendations }
  | { cached: false; task_id: string; event_id: string; event_url: string };
