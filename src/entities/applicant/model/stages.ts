import { APPLICATION_STATUSES, type ApplicationStatus } from '@/shared/api';
import type { Applicant, ApplicantSummary, ApplicantsPage, MatchScoreObj, RecruiterStatus } from './types';

/** Recruiter board columns (recruiter.html stages) mapped onto the real ApplicationStatus enum. */
export type PipelineStage = 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'closed';

export const PIPELINE_STAGES: PipelineStage[] = ['applied', 'screening', 'interview', 'offer', 'hired'];
/** Rejected + withdrawn, shown as a collapsed group. */
export const CLOSED_STAGE: PipelineStage = 'closed';

const STAGE_OF: Record<ApplicationStatus, PipelineStage> = {
  applied: 'applied',
  screened: 'screening',
  reviewed: 'screening',
  shortlisted: 'screening',
  'interview-scheduled': 'interview',
  interview: 'interview',
  'interview-completed': 'interview',
  'offer-pending': 'offer',
  offer: 'offer',
  'offer-accepted': 'offer',
  'offer-rejected': 'offer',
  hired: 'hired',
  rejected: 'closed',
  withdrawn: 'closed',
};

export function stageOf(status: ApplicationStatus | string): PipelineStage {
  return STAGE_OF[status as ApplicationStatus] ?? 'closed';
}

export const STATUSES_IN_STAGE: Record<PipelineStage, ApplicationStatus[]> = {
  applied: ['applied'],
  screening: ['screened', 'reviewed', 'shortlisted'],
  interview: ['interview-scheduled', 'interview', 'interview-completed'],
  offer: ['offer-pending', 'offer', 'offer-accepted', 'offer-rejected'],
  hired: ['hired'],
  closed: ['rejected', 'withdrawn'],
};

/** Every status a recruiter can move an application to (spec §4.2: never `withdrawn`). */
export const RECRUITER_STATUSES: RecruiterStatus[] = APPLICATION_STATUSES.filter(
  (s): s is RecruiterStatus => s !== 'withdrawn',
);

export function isRecruiterStatus(v: unknown): v is RecruiterStatus {
  return typeof v === 'string' && (RECRUITER_STATUSES as string[]).includes(v);
}

export function countByStage(summary: ApplicantSummary): Record<PipelineStage, number> {
  const out: Record<PipelineStage, number> = { applied: 0, screening: 0, interview: 0, offer: 0, hired: 0, closed: 0 };
  for (const st of APPLICATION_STATUSES) out[stageOf(st)] += summary[st] ?? 0;
  return out;
}

export function summaryFromRows(rows: { status: string }[]): ApplicantSummary {
  const s: ApplicantSummary = { total_applicants: rows.length };
  for (const r of rows) {
    const k = r.status as ApplicationStatus;
    s[k] = (s[k] ?? 0) + 1;
  }
  return s;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : v == null ? null : String(v));
const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
};

export function toMatchScoreObj(v: unknown): MatchScoreObj | null {
  if (!isObj(v)) return null;
  const pairs = (x: unknown) =>
    Array.isArray(x)
      ? x
          .filter(isObj)
          .map((p) => ({ criterion: str(p.criterion) ?? '', why: str(p.why) ?? '' }))
          .filter((p) => p.criterion || p.why)
      : undefined;
  const strs = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : undefined);
  return {
    score: num(v.score) ?? undefined,
    overall_match_percent: num(v.overall_match_percent) ?? undefined,
    blocked: typeof v.blocked === 'boolean' ? v.blocked : undefined,
    block_reasons: strs(v.block_reasons),
    top_strengths: pairs(v.top_strengths),
    top_gaps: pairs(v.top_gaps),
    skill_matches: strs(v.skill_matches),
    skill_gaps: strs(v.skill_gaps),
  };
}

export function toApplicant(v: unknown): Applicant | null {
  if (!isObj(v)) return null;
  const id = str(v.id);
  if (!id) return null;
  return {
    id,
    profile_id: str(v.profile_id) ?? '',
    name: str(v.name) ?? '',
    email: str(v.email),
    job_tite: str(v.job_tite ?? v.job_title),
    profile_picture: str(v.profile_picture),
    current_job_status: str(v.current_job_status),
    resume_used: str(v.resume_used),
    cover_letter_used: str(v.cover_letter_used),
    match_score: num(v.match_score),
    match_score_obj: toMatchScoreObj(v.match_score_obj),
    status: str(v.status) ?? 'applied',
    applied_at: str(v.applied_at) ?? '',
  };
}

/**
 * The applicants endpoint mixes the DRF envelope and a status-count summary
 * object in one JSON body (spec §4.2). Pull both out without trusting the layout.
 */
export function parseApplicantsResponse(payload: unknown): ApplicantsPage {
  const empty: ApplicantsPage = { count: 0, next: null, previous: null, results: [], summary: { total_applicants: 0 } };
  if (Array.isArray(payload)) {
    const rows = payload.map(toApplicant).filter((r): r is Applicant => !!r);
    return { ...empty, count: rows.length, results: rows, summary: summaryFromRows(rows) };
  }
  if (!isObj(payload)) return empty;
  const rowsRaw = Array.isArray(payload.results) ? payload.results : Array.isArray(payload.data) ? payload.data : [];
  const rows = rowsRaw.map(toApplicant).filter((r): r is Applicant => !!r);
  const summarySource = [payload.summary, payload.status_counts, payload.counts, payload].find(isObj) ?? {};
  const summary: ApplicantSummary = { total_applicants: 0 };
  for (const st of APPLICATION_STATUSES) {
    const n = num(summarySource[st]);
    if (n != null) summary[st] = n;
  }
  const total = num(summarySource.total_applicants) ?? num(payload.total_applicants);
  summary.total_applicants = total ?? num(payload.count) ?? rows.length;
  if (Object.keys(summary).length === 1 && rows.length) Object.assign(summary, summaryFromRows(rows), { total_applicants: summary.total_applicants });
  return {
    count: num(payload.count) ?? rows.length,
    next: str(payload.next),
    previous: str(payload.previous),
    results: rows,
    summary,
  };
}
