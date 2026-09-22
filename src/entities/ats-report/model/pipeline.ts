import { APPLICATION_STATUSES, type ApplicationStatus } from '@/shared/api';
import type { EfficiencyRow, PipelineRow } from './types';

/** The design's five stage columns plus a terminal "closed" column. */
export type StageGroup = 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'closed';
export const STAGE_GROUPS: StageGroup[] = ['applied', 'screening', 'interview', 'offer', 'hired', 'closed'];
/** Groups shown as funnel bars (the design's five). */
export const FUNNEL_GROUPS: StageGroup[] = ['applied', 'screening', 'interview', 'offer', 'hired'];

const GROUP_OF: Record<ApplicationStatus, StageGroup> = {
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

export function groupOf(status: ApplicationStatus): StageGroup {
  return GROUP_OF[status];
}

export type GroupCounts = Record<StageGroup, number>;

export function emptyGroupCounts(): GroupCounts {
  return { applied: 0, screening: 0, interview: 0, offer: 0, hired: 0, closed: 0 };
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** Collapse one pipeline row's 14 status counts into the six groups. */
export function groupRow(row: PipelineRow): GroupCounts {
  const out = emptyGroupCounts();
  for (const st of APPLICATION_STATUSES) out[GROUP_OF[st]] += num(row[st]);
  return out;
}

/** Sum the groups across every row (the overview's stage counters). */
export function sumGroups(rows: PipelineRow[]): GroupCounts {
  const out = emptyGroupCounts();
  for (const r of rows) {
    const g = groupRow(r);
    for (const k of STAGE_GROUPS) out[k] += g[k];
  }
  return out;
}

/** Candidates still moving through the funnel (not hired, rejected or withdrawn). */
export function activeCount(c: GroupCounts): number {
  return c.applied + c.screening + c.interview + c.offer;
}

export function totalCount(c: GroupCounts): number {
  return STAGE_GROUPS.reduce((n, k) => n + c[k], 0);
}

/** Median of the defined `time_to_hire_in_days` values, or null when no job has hired yet. */
export function medianTimeToHire(rows: EfficiencyRow[]): number | null {
  const xs = rows
    .map((r) => r.time_to_hire_in_days)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    .sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : Math.round(((xs[mid - 1] + xs[mid]) / 2) * 10) / 10;
}

/** Overall efficiency = hired / applied across all jobs, in percent; null with no applications. */
export function overallEfficiency(rows: EfficiencyRow[]): { applied: number; hired: number; pct: number | null } {
  const applied = rows.reduce((n, r) => n + num(r.total_applied), 0);
  const hired = rows.reduce((n, r) => n + num(r.total_hired), 0);
  return { applied, hired, pct: applied > 0 ? Math.round((hired / applied) * 1000) / 10 : null };
}

export interface KeyValueBar {
  label: string;
  value: number;
}

/**
 * hiring-data has no itemized shape in the spec. Accept the common
 * aggregate encodings — `{key: number}`, `{key: {count}}`, `[{name|label|source|department, count|value|total}]`,
 * possibly nested one level under a section key — and return label→number bars
 * per section. Anything else yields no sections (the UI then hides the block).
 */
export function keyValueSections(data: unknown): { title: string; bars: KeyValueBar[] }[] {
  const bars = barsFrom(data);
  if (bars.length) return [{ title: '', bars }];
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  const out: { title: string; bars: KeyValueBar[] }[] = [];
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    const b = barsFrom(v);
    if (b.length) out.push({ title: k.replace(/[_-]+/g, ' ').toLowerCase(), bars: b });
  }
  return out;
}

function barsFrom(v: unknown): KeyValueBar[] {
  if (Array.isArray(v)) {
    const out: KeyValueBar[] = [];
    for (const item of v) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const label = ['name', 'label', 'source', 'department', 'key', 'title'].map((k) => o[k]).find((x) => typeof x === 'string');
      const value = ['count', 'value', 'total', 'hired', 'n'].map((k) => o[k]).find((x) => typeof x === 'number');
      if (typeof label === 'string' && typeof value === 'number') out.push({ label, value });
    }
    return out;
  }
  if (v && typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>);
    const out: KeyValueBar[] = [];
    for (const [k, x] of entries) {
      if (typeof x === 'number') out.push({ label: k, value: x });
      else if (x && typeof x === 'object' && typeof (x as Record<string, unknown>).count === 'number') {
        out.push({ label: k, value: (x as Record<string, unknown>).count as number });
      }
    }
    // only treat as a flat map when every entry was numeric-ish
    return out.length === entries.length ? out : [];
  }
  return [];
}
