import { describe, expect, it } from 'vitest';
import { activeDatePreset, activeFilterCount, datePresetThreshold } from '@/features/job-feed/model/activeParams';
import { htmlToText, matchBadge, postedAgo, salaryLabel, searchItemMeta } from '@/features/job-feed/model/format';
import { statsBaseParams } from '@/features/job-feed/model/useJobStats';

const now = new Date('2026-09-17T12:00:00Z');

describe('date presets → date_posted (spec §2.3 gte, ISO date)', () => {
  it('maps periods to date-only thresholds', () => {
    expect(datePresetThreshold('any', now)).toBeUndefined();
    expect(datePresetThreshold('day', now)).toBe('2026-09-16');
    expect(datePresetThreshold('week', now)).toBe('2026-09-10');
    expect(datePresetThreshold('month', now)).toBe('2026-08-18');
  });
  it('recognises the active preset from params', () => {
    expect(activeDatePreset({}, now)).toBe('any');
    expect(activeDatePreset({ date_posted: '2026-09-10' }, now)).toBe('week');
    expect(activeDatePreset({ date_posted: '2020-01-01' }, now)).toBeNull();
  });
  it('stats base params drop paging and the date itself', () => {
    expect(statsBaseParams({ q: 'go', page: 3, page_size: 20, date_posted: '2026-09-10', grade: ['senior'] })).toEqual({ q: 'go', grade: ['senior'] });
  });
  it('counts only user-set filters', () => {
    expect(activeFilterCount({ q: 'x', page: 2 })).toBe(0);
    expect(activeFilterCount({ grade: ['senior'], work_format: [], salary__min_value: 100 })).toBe(2);
  });
});

describe('feed formatting', () => {
  it('builds the meta line from the flat search row', () => {
    const meta = searchItemMeta(
      {
        id: '1', slug: 'job-1', compImage: null, company: 'Fondym', designation: 'x', salary: '', time: 'full_time', type: 'remote',
        match: '82% Match', postedTime: '2026-09-15', deadline: null, job_locations: [{ country: 'Germany', region: null, locality: 'Berlin', street_address: null, postal_code: null, timezone: null }],
        source: 'internal', grade: 'senior', job_url: null,
      },
      now,
    );
    expect(meta).toBe('Fondym · Berlin, Germany · remote · full time · 2d ago');
  });
  it('lowercases the real match string and hides when absent', () => {
    expect(matchBadge('82% Match')).toBe('82% match');
    expect(matchBadge(null)).toBeNull();
    expect(matchBadge('  ')).toBeNull();
  });
  it('relative posted labels', () => {
    expect(postedAgo('2026-09-17', now)).toBe('today');
    expect(postedAgo('2026-09-16', now)).toBe('yesterday');
    expect(postedAgo('2026-08-01', now)).toBe('1mo ago');
    expect(postedAgo(null, now)).toBe('');
  });
  it('salary block from the nested §2.1 salary', () => {
    expect(salaryLabel(null)).toBe('negotiable');
    expect(salaryLabel({ currency: 'EUR', min_value: 75000, max_value: 90000, unit_text: 'YEAR' })).toBe('€75k–€90k / year');
    expect(salaryLabel({ currency: 'USD', min_value: 50, max_value: null, unit_text: 'HOUR' })).toBe('from $50 / hour');
  });
  it('html fallback strips tags', () => {
    expect(htmlToText('<p>Hello&nbsp;<b>world</b></p><ul><li>one</li><li>two</li></ul>')).toBe('Hello world\n• one\n• two');
  });
});
