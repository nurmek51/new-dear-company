import type {
  CandidateDoc,
  CandidateEducation,
  CandidateExperience,
  CandidateProfile,
  PoolCandidate,
  ProfileMatch,
} from './types';

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : typeof v === 'number' ? String(v) : null);
const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
};
/** Skills arrive as arrays of strings, arrays of {name}, or comma-separated strings. */
export function strList(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v
      .map((x) => (typeof x === 'string' ? x : isObj(x) ? str(x.name ?? x.title ?? x.skill ?? x.language) : null))
      .filter((x): x is string => !!x && x.trim() !== '')
      .map((x) => x.trim());
  }
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}
const pick = (o: Record<string, unknown>, keys: string[]): unknown => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k];
  return undefined;
};

export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toLowerCase();
}

/** Stable palette index for avatar colors (the design assigns per person). */
export function avatarIndex(seed: string | null | undefined, n: number): number {
  let h = 0;
  for (const ch of seed ?? '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return n > 0 ? h % n : 0;
}

export function toPoolCandidate(v: unknown): PoolCandidate | null {
  if (!isObj(v)) return null;
  const user = isObj(v.user) ? v.user : {};
  const id = str(v.id) ?? str(v.profile_id) ?? str(user.id);
  if (!id) return null;
  const salary = isObj(v.expected_salary) ? v.expected_salary : {};
  return {
    id,
    profile_id: str(v.profile_id) ?? id,
    name: str(pick(v, ['name', 'full_name', 'user_name'])) ?? str(user.name) ?? str(user.email) ?? '',
    email: str(v.email) ?? str(user.email),
    phone: str(pick(v, ['phone', 'phone_number'])) ?? str(user.phone_number),
    profile_picture: str(pick(v, ['profile_picture_display', 'profile_picture'])) ?? str(user.profile_picture_display),
    heading: str(pick(v, ['heading', 'headline', 'title'])),
    department: str(v.department),
    address: str(pick(v, ['address', 'location', 'city'])),
    skills: strList(v.skills),
    looking_for_designations: strList(v.looking_for_designations),
    years_of_experience: num(pick(v, ['years_of_experience', 'experience_years', 'total_experience'])),
    expected_salary_min: num(pick(v, ['expected_salary_min', 'salary_min'])) ?? num(salary.min_value),
    expected_salary_max: num(pick(v, ['expected_salary_max', 'salary_max'])) ?? num(salary.max_value),
    salary_currency: str(pick(v, ['expected_salary_currency', 'salary_currency', 'currency'])) ?? str(salary.currency),
    created_at: str(v.created_at),
  };
}

function toDoc(v: unknown): CandidateDoc | null {
  if (!isObj(v)) return null;
  const id = str(v.id);
  if (!id) return null;
  return { id, title: str(v.title) ?? str(v.name) ?? 'document', file: str(pick(v, ['file', 'file_url', 'url'])) };
}

function toExperience(v: unknown): CandidateExperience | null {
  if (!isObj(v)) return null;
  return {
    title: str(pick(v, ['title', 'position', 'designation', 'job_title'])),
    company: str(pick(v, ['company', 'company_name', 'organization'])),
    start: str(pick(v, ['start_date', 'from_date', 'start'])),
    end: str(pick(v, ['end_date', 'to_date', 'end'])),
    description: str(pick(v, ['description', 'summary'])),
  };
}

function toEducation(v: unknown): CandidateEducation | null {
  if (!isObj(v)) return null;
  return {
    degree: str(pick(v, ['degree', 'qualification', 'title'])),
    institution: str(pick(v, ['institution', 'school', 'university', 'institute'])),
    start: str(pick(v, ['start_date', 'from_date', 'start'])),
    end: str(pick(v, ['end_date', 'to_date', 'end'])),
  };
}

export function toCandidateProfile(v: unknown): CandidateProfile | null {
  const base = toPoolCandidate(v);
  if (!base || !isObj(v)) return null;
  const list = (x: unknown) => (Array.isArray(x) ? x : []);
  return {
    ...base,
    bio: str(pick(v, ['bio', 'about', 'summary'])),
    english_level: str(v.english_level),
    languages: strList(pick(v, ['languages', 'languages_proficiency', 'language_proficiencies'])),
    certifications: strList(v.certifications),
    resume_docs: list(v.resume_docs).map(toDoc).filter((d): d is CandidateDoc => !!d),
    cover_letter_docs: list(v.cover_letter_docs).map(toDoc).filter((d): d is CandidateDoc => !!d),
    completion_percentage: num(v.completion_percentage),
    work_experiences: list(pick(v, ['work_experiences', 'work_experience', 'experiences']))
      .map(toExperience)
      .filter((e): e is CandidateExperience => !!e),
    educations: list(pick(v, ['educations', 'education'])).map(toEducation).filter((e): e is CandidateEducation => !!e),
  };
}

export function toProfileMatch(v: unknown): ProfileMatch | null {
  if (!isObj(v)) return null;
  const profile = isObj(v.profile) ? v.profile : {};
  const profileUser = isObj(profile.user) ? profile.user : {};
  const profileId = str(v.profile_id) ?? str(profile.id) ?? str(v.id);
  if (!profileId) return null;
  const pairs = (x: unknown) =>
    Array.isArray(x)
      ? x.filter(isObj).map((p) => ({ criterion: str(p.criterion) ?? '', why: str(p.why) ?? '' })).filter((p) => p.criterion || p.why)
      : [];
  return {
    profile_id: profileId,
    name: str(pick(v, ['name', 'profile_name', 'candidate_name'])) ?? str(profile.name) ?? str(profileUser.name),
    heading: str(v.heading) ?? str(profile.heading),
    score: num(pick(v, ['score', 'overall_match_percent', 'match_score'])),
    skill_matches: strList(v.skill_matches),
    skill_gaps: strList(v.skill_gaps),
    top_strengths: pairs(v.top_strengths),
    top_gaps: pairs(v.top_gaps),
  };
}

/** Results may come as a bare array, a DRF page, or `{matches|results|profiles: []}`. */
export function extractRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isObj(payload)) return [];
  for (const k of ['results', 'matches', 'profiles', 'candidates', 'data']) {
    if (Array.isArray(payload[k])) return payload[k] as unknown[];
  }
  return [];
}
