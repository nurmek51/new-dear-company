import type { CandidateOrdering, ListCandidatesParams } from '@/entities/candidate-pool';

export interface Filters {
  skills: string;
  yearsMin: string;
  yearsMax: string;
  salaryMin: string;
  salaryMax: string;
  ordering: CandidateOrdering | null;
}

export const EMPTY_FILTERS: Filters = { skills: '', yearsMin: '', yearsMax: '', salaryMin: '', salaryMax: '', ordering: null };
export const ORDERINGS: { key: CandidateOrdering; label: string }[] = [
  { key: '-created_at', label: 'newest' },
  { key: '-years_of_experience', label: 'most experience' },
  { key: 'years_of_experience', label: 'least experience' },
];

const num = (s: string): number | undefined => {
  const v = Number(s.trim());
  return s.trim() && Number.isFinite(v) ? v : undefined;
};

/** Filters + search → GET /api/v1/ats/candidates/ query (spec §4.3). */
export function toListParams(query: string, f: Filters, page: number): ListCandidatesParams {
  const p: ListCandidatesParams = { page };
  if (query.trim()) p.search = query.trim();
  const skills = f.skills.split(',').map((s) => s.trim()).filter(Boolean).join(',');
  if (skills) p.skills = skills;
  const ymin = num(f.yearsMin);
  const ymax = num(f.yearsMax);
  if (ymin != null) p.years_of_experience__gte = ymin;
  if (ymax != null) p.years_of_experience__lte = ymax;
  const smin = num(f.salaryMin);
  const smax = num(f.salaryMax);
  if (smin != null) p.expected_salary_min = smin;
  if (smax != null) p.expected_salary_max = smax;
  if (f.ordering) p.ordering = f.ordering;
  return p;
}
