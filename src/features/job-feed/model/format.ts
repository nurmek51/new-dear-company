import type { Job, JobLocation, JobSearchItem } from '@/entities/job';
import { currencyLabel, humanize } from '@/shared/api';

/** "Berlin, Germany" / "Germany" / "" for the first location. */
export function locationLabel(locs: JobLocation[] | undefined): string {
  const l = locs?.[0];
  if (!l) return '';
  return [l.locality, l.country].filter((x): x is string => !!x && x.trim().length > 0).join(', ');
}

/** Relative "posted" label from an ISO date (whole days; the API gives a date). */
export function postedAgo(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const days = Math.max(0, Math.floor((now.getTime() - at.getTime()) / 86400000));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/** Card meta line: company · location · work format · employment type · posted. */
export function searchItemMeta(j: JobSearchItem, now: Date = new Date()): string {
  return [j.company, locationLabel(j.job_locations), j.type ? humanize(j.type) : '', j.time ? humanize(j.time) : '', postedAgo(j.postedTime, now)]
    .filter((x) => x.length > 0)
    .join(' · ');
}

/** "82% Match" → "82% match"; null/empty → null. */
export function matchBadge(match: string | null | undefined): string | null {
  const m = match?.trim();
  return m ? m.toLowerCase() : null;
}

/** Salary block on the detail page from the §2.1 nested salary. */
export function salaryLabel(salary: Job['salary']): string {
  if (!salary || (salary.min_value == null && salary.max_value == null)) return 'negotiable';
  const sym = currencyLabel(salary.currency);
  const fmt = (n: number) => (n >= 1000 ? `${sym}${Math.round(n / 1000)}k` : `${sym}${n}`);
  const range =
    salary.min_value != null && salary.max_value != null
      ? `${fmt(salary.min_value)}–${fmt(salary.max_value)}`
      : salary.min_value != null
        ? `from ${fmt(salary.min_value)}`
        : `up to ${fmt(salary.max_value as number)}`;
  const unit = salary.unit_text ? ` / ${String(salary.unit_text).toLowerCase()}` : '';
  return `${range}${unit}`;
}

/** Deterministic palette pick for letter logos (oc1..oc5 token pairs). */
export function logoTone(name: string): { bg: 'oc1bg' | 'oc2bg' | 'oc3bg' | 'oc4bg' | 'oc5bg'; fg: 'oc1' | 'oc2' | 'oc3' | 'oc4' | 'oc5' } {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const i = (h % 5) + 1;
  return { bg: `oc${i}bg` as 'oc1bg', fg: `oc${i}` as 'oc1' };
}

/** Very small HTML → text fallback for `description_html` when `description_text` is empty. */
export function htmlToText(html: string): string {
  return html
    .replace(/<\s*(br|\/p|\/li|\/h[1-6]|\/div)\s*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
