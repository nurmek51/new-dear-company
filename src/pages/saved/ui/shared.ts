import type { Job, JobSearchParams } from '@/entities/job';
import { currencyLabel, humanize } from '@/shared/api';
import type { Palette } from '@/shared/theme';

/** Design logo tints, chosen deterministically from the company name. */
const TINTS: [keyof Palette, keyof Palette][] = [
  ['greenbg', 'green'],
  ['oc2bg', 'oc2'],
  ['oc1bg', 'oc1'],
  ['oc5bg', 'oc5'],
  ['oc3bg', 'oc3'],
  ['oc4bg', 'oc4'],
];
export function logoTint(t: Palette, name: string): { bg: string; color: string } {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [bg, color] = TINTS[h % TINTS.length];
  return { bg: t[bg], color: t[color] };
}

export function salaryText(j: Job): string | null {
  const s = j.salary;
  if (!s || (s.min_value == null && s.max_value == null)) return null;
  const sym = currencyLabel(s.currency);
  const k = (n: number | null) => (n == null ? '' : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
  const range = s.min_value != null && s.max_value != null ? `${k(s.min_value)}–${k(s.max_value)}` : k(s.min_value ?? s.max_value);
  return `${sym}${range}`;
}

export function locationText(j: Job): string | null {
  const l = j.job_locations[0];
  const place = l ? l.locality || l.region || l.country : null;
  const fmt = j.work_format ? humanize(String(j.work_format)) : j.remote_option ? 'remote' : null;
  if (place && fmt && fmt !== 'onsite') return `${place}, ${fmt}`;
  return place ?? fmt;
}

/** "today" / "yesterday" / "3d ago" / "2w ago" — relative, lowercase, like the design. */
export function relativeDay(iso: string | null | undefined, now = Date.now()): string | null {
  if (!iso) return null;
  const ms = now - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  const d = Math.floor(ms / 86400000);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 14) return `${d}d ago`;
  if (d < 60) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

/** Days until a deadline (negative when past); null when there is none. */
export function daysUntil(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now;
  if (!Number.isFinite(ms)) return null;
  return Math.ceil(ms / 86400000);
}

/** Flatten a saved search's preference_data into chip labels. */
export function paramChips(data: Record<string, unknown> | null): string[] {
  if (!data) return [];
  const out: string[] = [];
  for (const [key, v] of Object.entries(data)) {
    if (key === 'page' || key === 'page_size' || v == null || v === '') continue;
    if (key === 'q') {
      if (typeof v === 'string' && v.trim()) out.push(`“${v.trim()}”`);
      continue;
    }
    if (Array.isArray(v)) {
      for (const item of v) if (item != null && item !== '') out.push(humanize(String(item)));
      continue;
    }
    if (key === 'salary__min_value') out.push(`${v}+`);
    else if (key === 'date_posted') out.push(`posted since ${String(v)}`);
    else out.push(`${humanize(key.replace('organization__', ''))}: ${humanize(String(v))}`);
  }
  return out;
}

/** The snapshot stored as preference_data: the active params without paging. */
export function snapshotParams(p: JobSearchParams): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    if (k === 'page' || k === 'page_size' || v == null || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}
