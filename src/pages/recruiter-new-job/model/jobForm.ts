import type { Job, JobWriteInput } from '@/entities/job';
import {
  EMPLOYMENT_TYPES,
  ENGLISH_LEVELS,
  GRADES,
  WORK_FORMATS,
  type EmploymentType,
  type EnglishLevel,
  type Grade,
  type WorkFormat,
} from '@/shared/api';

/** Form state for POST/PATCH /api/v1/jobs/ (spec §2.1–2.2). Strings only; parsed on submit. */
export interface JobForm {
  title: string;
  department: string;
  description_text: string;
  responsibilities: string;
  employment_type: EmploymentType;
  work_format: WorkFormat | null;
  grade: Grade | null;
  english_level: EnglishLevel | null;
  remote_option: boolean;
  /** comma separated */
  skills: string;
  experience_required: string;
  /** one per line */
  qualifications: string;
  highlights: string;
  auto_screening_questions: string;
  /** YYYY-MM-DD */
  date_validthrough: string;
  publish: boolean;
}

export function emptyJobForm(): JobForm {
  return {
    title: '',
    department: '',
    description_text: '',
    responsibilities: '',
    employment_type: 'full_time',
    work_format: 'remote',
    grade: null,
    english_level: null,
    remote_option: true,
    skills: '',
    experience_required: '',
    qualifications: '',
    highlights: '',
    auto_screening_questions: '',
    date_validthrough: '',
    publish: true,
  };
}

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const commas = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export function isWorkFormat(v: unknown): v is WorkFormat {
  return typeof v === 'string' && (WORK_FORMATS as string[]).includes(v);
}
export function isEmploymentType(v: unknown): v is EmploymentType {
  return typeof v === 'string' && (EMPLOYMENT_TYPES as string[]).includes(v);
}
export function isGrade(v: unknown): v is Grade {
  return typeof v === 'string' && (GRADES as string[]).includes(v);
}
export function isEnglishLevel(v: unknown): v is EnglishLevel {
  return typeof v === 'string' && (ENGLISH_LEVELS as string[]).includes(v.toUpperCase());
}

export interface JobFormErrors {
  title?: string;
  description_text?: string;
  experience_required?: string;
  date_validthrough?: string;
}

export function validateJobForm(f: JobForm): JobFormErrors {
  const e: JobFormErrors = {};
  if (!f.title.trim()) e.title = 'a job title is required';
  if (!f.description_text.trim()) e.description_text = 'a description is required — the public job page shows it as is';
  if (f.experience_required.trim() && !Number.isFinite(Number(f.experience_required))) e.experience_required = 'years, e.g. 3 or 3.5';
  if (f.date_validthrough.trim()) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f.date_validthrough.trim());
    const d = m ? new Date(`${f.date_validthrough.trim()}T23:59:59Z`) : null;
    if (!m || !d || Number.isNaN(d.getTime())) e.date_validthrough = 'use YYYY-MM-DD';
    else if (d.getTime() < Date.now()) e.date_validthrough = 'that date is already in the past';
  }
  return e;
}

/** Build the write payload. `wasPublished` → published_at is omitted (spec §2.2: not editable once published). */
export function toWriteInput(f: JobForm, opts: { wasPublished: boolean; now?: Date }): JobWriteInput {
  const now = opts.now ?? new Date();
  const out: JobWriteInput = {
    title: f.title.trim(),
    department: f.department.trim() || undefined,
    description_text: f.description_text.trim(),
    responsibilities: f.responsibilities.trim() || undefined,
    employment_type: f.employment_type,
    work_format: f.work_format,
    grade: f.grade,
    english_level: f.english_level,
    remote_option: f.remote_option,
    skills_required: commas(f.skills).map((s) => s.toUpperCase()),
    qualifications: lines(f.qualifications),
    highlights: lines(f.highlights),
    auto_screening_questions: lines(f.auto_screening_questions),
    date_validthrough: f.date_validthrough.trim() ? `${f.date_validthrough.trim()}T23:59:59Z` : null,
  };
  if (f.experience_required.trim()) out.experience_required = Number(f.experience_required);
  if (!opts.wasPublished) out.published_at = f.publish ? now.toISOString() : null;
  return out;
}

export function fromJob(j: Job): JobForm {
  return {
    title: j.title ?? '',
    department: j.department ?? '',
    description_text: j.description_text ?? '',
    responsibilities: j.responsibilities ?? '',
    employment_type: isEmploymentType(j.employment_type) ? j.employment_type : 'full_time',
    work_format: isWorkFormat(j.work_format) ? j.work_format : null,
    grade: isGrade(j.grade) ? j.grade : null,
    english_level: isEnglishLevel(j.english_level) ? (j.english_level.toUpperCase() as EnglishLevel) : null,
    remote_option: !!j.remote_option,
    skills: (j.skills_required ?? []).join(', '),
    experience_required: j.experience_required == null ? '' : String(j.experience_required),
    qualifications: (j.qualifications ?? []).join('\n'),
    highlights: (j.highlights ?? []).join('\n'),
    auto_screening_questions: (j.auto_screening_questions ?? []).join('\n'),
    date_validthrough: j.date_validthrough ? j.date_validthrough.slice(0, 10) : '',
    publish: !!j.published_at,
  };
}

/* ---------- AI job creation (spec §2.6) — the SSE payload shape is not itemized; map defensively ---------- */

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const strArr = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map((x) => (typeof x === 'string' ? x : isObj(x) ? str(x.name ?? x.text ?? x.question) : null)).filter((x): x is string => !!x)
    : typeof v === 'string'
      ? v.split(/\n|,/).map((s) => s.trim()).filter(Boolean)
      : [];

function looksLikeJob(o: Record<string, unknown>): boolean {
  return ['title', 'job_title', 'description_text', 'description', 'skills_required', 'responsibilities'].some((k) => o[k] !== undefined);
}

export interface AiDraftEvent {
  kind: 'progress' | 'draft' | 'error';
  message?: string;
  draft?: Partial<JobForm>;
}

/** Turn one SSE `data:` payload into a form patch, a progress note, or an error. */
export function parseAiJobEvent(payload: unknown, event?: string): AiDraftEvent {
  // The task finishes on a `success` event and fails on `error` (verified in
  // apps/jobs/tasks.py); the payload carries the job under `data`.
  let o: unknown = payload;
  if (event === 'error') {
    const message = isObj(o) ? (str(o.message) ?? str(o.detail)) : typeof o === 'string' ? o : null;
    return { kind: 'error', message: message ?? 'the ai draft failed' };
  }
  if (typeof o === 'string') {
    const text: string = o;
    try {
      o = JSON.parse(text);
    } catch {
      return { kind: 'progress', message: text };
    }
  }
  if (!isObj(o)) return { kind: 'progress' };
  const status = str(o.status)?.toLowerCase() ?? null;
  const errText = str(o.error) ?? str(o.detail) ?? (status && ['failed', 'failure', 'error'].includes(status) ? str(o.message) ?? 'the ai draft failed' : null);
  if (errText && (!status || ['failed', 'failure', 'error'].includes(status))) return { kind: 'error', message: errText };

  const candidates: unknown[] = [o, o.result, o.data, o.job, o.payload, o.output, o.job_data];
  const nested = candidates.find((c): c is Record<string, unknown> => isObj(c) && looksLikeJob(c));
  if (!nested) return { kind: 'progress', message: str(o.message) ?? str(o.stage) ?? (status ?? undefined) };

  const d: Partial<JobForm> = {};
  const title = str(nested.title) ?? str(nested.job_title);
  if (title) d.title = title;
  const dept = str(nested.department) ?? str(nested.team);
  if (dept) d.department = dept;
  const desc = str(nested.description_text) ?? str(nested.description);
  if (desc) d.description_text = desc;
  const resp = nested.responsibilities;
  if (typeof resp === 'string' && resp.trim()) d.responsibilities = resp;
  else if (Array.isArray(resp)) d.responsibilities = strArr(resp).join('\n');
  if (isEmploymentType(nested.employment_type)) d.employment_type = nested.employment_type;
  if (isWorkFormat(nested.work_format)) d.work_format = nested.work_format;
  if (isGrade(nested.grade)) d.grade = nested.grade;
  if (isEnglishLevel(nested.english_level)) d.english_level = String(nested.english_level).toUpperCase() as EnglishLevel;
  if (typeof nested.remote_option === 'boolean') d.remote_option = nested.remote_option;
  const skills = strArr(nested.skills_required ?? nested.skills);
  if (skills.length) d.skills = skills.join(', ');
  const exp = nested.experience_required;
  if (typeof exp === 'number' || (typeof exp === 'string' && exp.trim() && Number.isFinite(Number(exp)))) d.experience_required = String(exp);
  const q = strArr(nested.qualifications);
  if (q.length) d.qualifications = q.join('\n');
  const h = strArr(nested.highlights);
  if (h.length) d.highlights = h.join('\n');
  const asq = strArr(nested.auto_screening_questions ?? nested.screening_questions);
  if (asq.length) d.auto_screening_questions = asq.join('\n');
  const vt = str(nested.date_validthrough);
  if (vt && /^\d{4}-\d{2}-\d{2}/.test(vt)) d.date_validthrough = vt.slice(0, 10);
  return Object.keys(d).length ? { kind: 'draft', draft: d } : { kind: 'progress', message: str(o.message) ?? undefined };
}
