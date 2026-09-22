import { describe, expect, it } from 'vitest';
import { emptyJobForm, parseAiJobEvent, toWriteInput, validateJobForm } from '@/pages/recruiter-new-job/model/jobForm';
import { EMPTY_FILTERS, toListParams } from '@/pages/recruiter-candidates/model/params';

describe('new job form model (spec §2.1–2.2)', () => {
  it('requires title + description and validates the date', () => {
    const e = validateJobForm({ ...emptyJobForm(), date_validthrough: '2020-01-01' });
    expect(e.title).toBeTruthy();
    expect(e.description_text).toBeTruthy();
    expect(e.date_validthrough).toMatch(/past/);
    expect(validateJobForm({ ...emptyJobForm(), title: 'x', description_text: 'y', date_validthrough: '13/01/2030' }).date_validthrough).toMatch(/YYYY/);
  });
  it('maps strings → arrays, publish toggle → published_at, and omits published_at once published', () => {
    const now = new Date('2030-01-01T00:00:00Z');
    const f = { ...emptyJobForm(), title: ' Designer ', description_text: 'd', skills: 'figma, react,', qualifications: 'a\n\nb', publish: true, experience_required: '3.5', date_validthrough: '2031-01-01' };
    const w = toWriteInput(f, { wasPublished: false, now });
    expect(w.title).toBe('Designer');
    expect(w.skills_required).toEqual(['FIGMA', 'REACT']);
    expect(w.qualifications).toEqual(['a', 'b']);
    expect(w.experience_required).toBe(3.5);
    expect(w.published_at).toBe(now.toISOString());
    expect(w.date_validthrough).toBe('2031-01-01T23:59:59Z');
    expect(toWriteInput({ ...f, publish: false }, { wasPublished: false, now }).published_at).toBeNull();
    expect('published_at' in toWriteInput(f, { wasPublished: true, now })).toBe(false);
  });
  it('parses an SSE payload defensively into a draft, progress or error', () => {
    expect(parseAiJobEvent('{"status":"processing","message":"thinking"}')).toEqual({ kind: 'progress', message: 'thinking' });
    expect(parseAiJobEvent({ status: 'failed', error: 'boom' }).kind).toBe('error');
    const d = parseAiJobEvent({ result: { title: 'PM', description: 'desc', skills_required: ['A', 'B'], employment_type: 'part_time', work_format: 'nope', grade: 'senior', qualifications: 'q1\nq2' } });
    expect(d.kind).toBe('draft');
    expect(d.draft).toMatchObject({ title: 'PM', description_text: 'desc', skills: 'A, B', employment_type: 'part_time', grade: 'senior', qualifications: 'q1\nq2' });
    expect(d.draft?.work_format).toBeUndefined();
  });
});

describe('candidate pool filters → query params (spec §4.3)', () => {
  it('only sends what is set, as the documented param names', () => {
    expect(toListParams('', EMPTY_FILTERS, 2)).toEqual({ page: 2 });
    const p = toListParams(' ann ', { skills: 'go, k8s,', yearsMin: '3', yearsMax: 'x', salaryMin: '', salaryMax: '5000', ordering: '-created_at' }, 1);
    expect(p).toEqual({ page: 1, search: 'ann', skills: 'go,k8s', years_of_experience__gte: 3, expected_salary_max: 5000, ordering: '-created_at' });
  });
});
