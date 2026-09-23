import { beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyTaskEvent } from '@/entities/resume/model/asyncResult';
import { parseAiJobEvent } from '@/pages/recruiter-new-job/model/jobForm';
import { jobsApi } from '@/entities/job';
import { clearTokens } from '@/shared/api/tokens';

/**
 * These lock in shapes verified against the Django source, not the prose spec:
 * SSE event names differ per flow, and the saved-jobs create action is broken
 * so writes must go through `toggle/`.
 */
describe('SSE frame classification (apps/resumes/tasks.py, apps/jobs/tasks.py)', () => {
  it('treats an `error` event as a failure whatever the body says', () => {
    expect(classifyTaskEvent({ status: 'error', message: 'Could not read the file' }, 'error')).toEqual({
      kind: 'error',
      message: 'Could not read the file',
    });
  });

  it('treats a `warning` event as progress, not a result', () => {
    const ev = classifyTaskEvent({ status: 'warning', message: 'B2C profile already exists' }, 'warning');
    expect(ev.kind).toBe('progress');
  });

  it('keeps waiting through the intermediate profile_created frame', () => {
    const ev = classifyTaskEvent({ status: 'profile_created', message: 'B2C profile created', profile_id: 'p1' }, 'message');
    expect(ev.kind).toBe('progress');
  });

  it('accepts the resume-parsing result delivered on the `success` event', () => {
    const ev = classifyTaskEvent({ status: 'completed', resume_id: 'r1', parsed_data: { parsed_data: { skills: ['go'] } } }, 'success');
    expect(ev.kind).toBe('done');
  });

  it('unwraps assessment_results from the `message` event', () => {
    const ev = classifyTaskEvent({ status: 'success', assessment_results: { score: 72 } }, 'message');
    expect(ev).toEqual({ kind: 'done', result: { score: 72 } });
  });
});

describe('AI job drafting frames (apps/jobs/tasks.py)', () => {
  it('reads the draft from `data` on the success event', () => {
    const ev = parseAiJobEvent(
      { status: 'success', message: 'AI job generation completed successfully.', data: { title: 'Backend Engineer', description_text: 'Go and Postgres.' } },
      'success',
    );
    expect(ev.kind).toBe('draft');
    expect(ev.draft?.title).toBe('Backend Engineer');
  });

  it('fails on the error event', () => {
    expect(parseAiJobEvent({ status: 'error', message: 'model timeout' }, 'error')).toEqual({ kind: 'error', message: 'model timeout' });
  });
});

describe('saved jobs (apps/accounts/views_v2/b2c_job_operation.py)', () => {
  beforeEach(async () => {
    await clearTokens();
  });

  it('writes through toggle/ and reports which way it went', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ detail: 'Job unsaved.' }),
    } as unknown as Response);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await jobsApi.toggleSavedJob('job-1');

    expect(result).toBe('unsaved');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/api/v1/jobs/saved-jobs/toggle/');
    expect(fetchMock.mock.calls[0][1].body).toBe('{"job":"job-1"}');
  });

  it('reads the list even though it is a bare array, not a DRF envelope', async () => {
    const rows = [{ id: 7, job: { id: 'job-1', title: 'Backend Engineer' }, created_at: '2026-01-01' }];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(rows),
    } as unknown as Response) as unknown as typeof fetch;

    const page = await jobsApi.listSavedJobs();
    expect(page.count).toBe(1);
    expect(page.results[0].id).toBe(7);
  });
});

describe('job filter options', () => {
  it('normalizes the live filters-list shape to search parameter values', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        work_types: [{ value: 'full_time', label: 'Full-Time' }],
        work_formats: [{ value: 'remote', label: 'Remote' }],
        vacancy_languages: [{ value: 'EN', label: 'English' }],
        currency: [{ value: 'USD', label: 'USD' }],
        grades: [{ value: 'senior', label: 'Senior' }],
        specializations: [{ value: 'BACKEND', label: 'Backend' }, null],
      }),
    } as unknown as Response) as unknown as typeof fetch;

    const filters = await jobsApi.getFiltersList();

    expect(filters.employment_types).toEqual(['full_time']);
    expect(filters.work_formats).toEqual(['remote']);
    expect(filters.languages).toEqual(['EN']);
    expect(filters.currencies).toEqual(['USD']);
    expect(filters.grades).toEqual(['senior']);
    expect(filters.specializations).toEqual(['BACKEND']);
  });

  it('still accepts the documented string-array shape', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ work_formats: ['remote', 'hybrid'] }),
    } as unknown as Response) as unknown as typeof fetch;

    await expect(jobsApi.getFiltersList()).resolves.toMatchObject({ work_formats: ['remote', 'hybrid'] });
  });
});
