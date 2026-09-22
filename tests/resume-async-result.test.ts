import { describe, expect, it } from 'vitest';
import { classifyTaskEvent, summarizeResult } from '../src/entities/resume/model/asyncResult';

describe('classifyTaskEvent (spec §0.2 SSE payloads)', () => {
  it('treats pending statuses as progress', () => {
    expect(classifyTaskEvent({ status: 'processing', message: 'extracting' })).toEqual({ kind: 'progress', message: 'extracting' });
    expect(classifyTaskEvent('ping')).toEqual({ kind: 'progress', message: null });
  });
  it('reports failures', () => {
    expect(classifyTaskEvent({ status: 'failed', message: 'bad file' })).toEqual({ kind: 'error', message: 'bad file' });
    expect(classifyTaskEvent({ error: 'boom' })).toEqual({ kind: 'error', message: 'boom' });
    expect(classifyTaskEvent({ success: false, message: 'nope' })).toEqual({ kind: 'error', message: 'nope' });
  });
  it('unwraps result envelopes and passes plain objects through', () => {
    expect(classifyTaskEvent({ status: 'completed', assessment_results: { score: 72 } })).toEqual({ kind: 'done', result: { score: 72 } });
    expect(classifyTaskEvent({ job_fit_summary: 'ok' })).toEqual({ kind: 'done', result: { job_fit_summary: 'ok' } });
  });
});

describe('summarizeResult (opaque assessment JSON)', () => {
  it('extracts a score and headline and renders the rest as blocks', () => {
    const s = summarizeResult({
      overall_score: '72',
      verdict: 'solid cv',
      strengths: ['clear dates', 'one page'],
      sections: [{ title: 'summary', feedback: 'repeats titles' }],
      meta: { pages: 1 },
      empty: null,
    });
    expect(s.score).toBe(72);
    expect(s.headline).toBe('solid cv');
    expect(s.blocks.map((b) => b.key)).toEqual(['strengths', 'sections', 'meta']);
    expect(s.blocks[0].items).toEqual(['clear dates', 'one page']);
    expect(s.blocks[1].children?.[0].title).toBe('summary');
    expect(s.blocks[2].children?.[0]).toMatchObject({ title: 'pages', text: '1' });
  });
  it('handles strings and non-objects', () => {
    expect(summarizeResult('just text').blocks[0].text).toBe('just text');
    expect(summarizeResult(42).blocks).toEqual([]);
  });
});
