import { describe, expect, it } from 'vitest';
import {
  activeCount,
  groupOf,
  groupRow,
  keyValueSections,
  medianTimeToHire,
  overallEfficiency,
  sumGroups,
} from '@/entities/ats-report';

describe('ats report pipeline grouping (spec §4.2)', () => {
  it('collapses the 14 statuses into the design groups', () => {
    expect(groupOf('applied')).toBe('applied');
    expect(groupOf('screened')).toBe('screening');
    expect(groupOf('reviewed')).toBe('screening');
    expect(groupOf('shortlisted')).toBe('screening');
    expect(groupOf('interview-scheduled')).toBe('interview');
    expect(groupOf('interview-completed')).toBe('interview');
    expect(groupOf('offer-pending')).toBe('offer');
    expect(groupOf('offer-rejected')).toBe('offer');
    expect(groupOf('hired')).toBe('hired');
    expect(groupOf('rejected')).toBe('closed');
    expect(groupOf('withdrawn')).toBe('closed');
  });

  it('groups and sums rows, ignoring missing/non-numeric counts', () => {
    const a = { jobTitle: 'a', applied: 3, screened: 1, shortlisted: 1, interview: 2, offer: 1, hired: 1, rejected: 4 };
    const b = { jobTitle: 'b', applied: 2, withdrawn: 1 };
    expect(groupRow(a)).toEqual({ applied: 3, screening: 2, interview: 2, offer: 1, hired: 1, closed: 4 });
    const s = sumGroups([a, b]);
    expect(s).toEqual({ applied: 5, screening: 2, interview: 2, offer: 1, hired: 1, closed: 5 });
    expect(activeCount(s)).toBe(10);
  });

  it('computes median time to hire and overall efficiency', () => {
    const row = (t: number | null, applied: number, hired: number) => ({
      job_id: 'x', job_title: 'x', total_applied: applied, total_hired: hired, hiring_efficiency_in_percentage: null,
      first_application_date: null, first_offer_accepted_date: null, time_to_hire_in_days: t, time_to_fill_in_days: null,
    });
    expect(medianTimeToHire([])).toBeNull();
    expect(medianTimeToHire([row(10, 1, 1), row(null, 1, 0), row(30, 1, 1)])).toBe(20);
    expect(medianTimeToHire([row(10, 1, 1), row(20, 1, 1), row(30, 1, 1)])).toBe(20);
    expect(overallEfficiency([row(10, 8, 2), row(null, 2, 0)])).toEqual({ applied: 10, hired: 2, pct: 20 });
    expect(overallEfficiency([]).pct).toBeNull();
  });

  it('reads generic hiring-data aggregates and hides unknown shapes', () => {
    expect(keyValueSections({ by_source: { referral: 2, 'job post': 4 } })).toEqual([
      { title: 'by source', bars: [{ label: 'referral', value: 2 }, { label: 'job post', value: 4 }] },
    ]);
    expect(keyValueSections([{ department: 'design', count: 3 }])).toEqual([{ title: '', bars: [{ label: 'design', value: 3 }] }]);
    expect(keyValueSections({ detail: 'nothing' })).toEqual([]);
    expect(keyValueSections(null)).toEqual([]);
  });
});
