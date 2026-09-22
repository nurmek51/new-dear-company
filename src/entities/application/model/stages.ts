import type { ApplicationStatus } from '@/shared/api';
import type { CandidateStatusUpdate } from './types';

/** Design stage tabs (seeker.html stageDefs) mapped onto the real ApplicationStatus enum. */
export type StageKey = 'applied' | 'reading' | 'interview' | 'offer' | 'archived';

export const STAGE_ORDER: StageKey[] = ['applied', 'reading', 'interview', 'offer', 'archived'];

export const STAGE_LABELS: Record<StageKey, string> = {
  applied: 'applied',
  reading: 'being read',
  interview: 'interview',
  offer: 'offer',
  archived: 'archived',
};

const STAGE_OF: Record<ApplicationStatus, StageKey> = {
  applied: 'applied',
  screened: 'reading',
  reviewed: 'reading',
  shortlisted: 'reading',
  'interview-scheduled': 'interview',
  interview: 'interview',
  'interview-completed': 'interview',
  'offer-pending': 'offer',
  offer: 'offer',
  'offer-accepted': 'offer',
  'offer-rejected': 'offer',
  rejected: 'archived',
  hired: 'archived',
  withdrawn: 'archived',
};

export function stageOf(status: ApplicationStatus | string): StageKey {
  return STAGE_OF[status as ApplicationStatus] ?? 'archived';
}

export function countByStage<T extends { status: ApplicationStatus | string }>(rows: T[]): Record<StageKey, number> {
  const out: Record<StageKey, number> = { applied: 0, reading: 0, interview: 0, offer: 0, archived: 0 };
  for (const r of rows) out[stageOf(r.status)] += 1;
  return out;
}

/** Spec §4.1: offer-accepted/offer-rejected only from 'offer'; withdrawn only from 'applied'. */
export function allowedCandidateTransitions(status: ApplicationStatus | string): CandidateStatusUpdate[] {
  if (status === 'offer') return ['offer-accepted', 'offer-rejected'];
  if (status === 'applied') return ['withdrawn'];
  return [];
}

export function canTransition(from: ApplicationStatus | string, to: CandidateStatusUpdate): boolean {
  return allowedCandidateTransitions(from).includes(to);
}

/** Client-side search over loaded rows (title / company). */
export function matchesQuery(row: { job: { title: string; organization: { name: string } | null } }, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return `${row.job.title} ${row.job.organization?.name ?? ''}`.toLowerCase().includes(needle);
}
