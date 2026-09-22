import { describe, expect, it } from 'vitest';
import { allowedCandidateTransitions, canTransition, countByStage, matchesQuery, stageOf } from '@/entities/application/model/stages';

describe('application stages (spec §4)', () => {
  it('groups every ApplicationStatus into a design stage', () => {
    expect(stageOf('applied')).toBe('applied');
    expect(stageOf('screened')).toBe('reading');
    expect(stageOf('shortlisted')).toBe('reading');
    expect(stageOf('interview-scheduled')).toBe('interview');
    expect(stageOf('offer-pending')).toBe('offer');
    expect(stageOf('offer-rejected')).toBe('offer');
    expect(stageOf('hired')).toBe('archived');
    expect(stageOf('withdrawn')).toBe('archived');
    expect(stageOf('unknown-status')).toBe('archived');
  });

  it('counts per stage', () => {
    const c = countByStage([{ status: 'applied' }, { status: 'reviewed' }, { status: 'offer' }, { status: 'rejected' }]);
    expect(c).toEqual({ applied: 1, reading: 1, interview: 0, offer: 1, archived: 1 });
  });

  it('only allows the candidate transitions from the spec', () => {
    expect(allowedCandidateTransitions('offer')).toEqual(['offer-accepted', 'offer-rejected']);
    expect(allowedCandidateTransitions('applied')).toEqual(['withdrawn']);
    expect(allowedCandidateTransitions('interview')).toEqual([]);
    expect(canTransition('offer', 'withdrawn')).toBe(false);
    expect(canTransition('screened', 'withdrawn')).toBe(false);
  });

  it('matches loaded rows by title or company', () => {
    const row = { job: { title: 'Product Designer', organization: { name: 'Lumen' } } };
    expect(matchesQuery(row, 'lumen')).toBe(true);
    expect(matchesQuery(row, 'DESIGN')).toBe(true);
    expect(matchesQuery(row, 'rust')).toBe(false);
    expect(matchesQuery(row, '  ')).toBe(true);
  });
});
