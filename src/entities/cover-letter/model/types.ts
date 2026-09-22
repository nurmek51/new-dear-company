/** Spec §3.7 — CoverLetter ModelViewSet fields. */
export interface CoverLetter {
  id: string;
  title: string;
  file: string;
  is_selected: boolean;
  is_ai_generated: boolean;
  /** job uuid (or null) */
  job: string | null;
  created_at: string;
  updated_at?: string;
}
