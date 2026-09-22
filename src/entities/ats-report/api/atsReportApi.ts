import { request, toPage, type Paginated } from '@/shared/api';
import type { EfficiencyRow, HiringData, InsightType, PipelineRow, PostedJob } from '../model/types';

/** GET /api/v1/ats/b2b-posted-jobs/ (spec §4.2, IsB2BUser, paginated). */
export async function listPostedJobs(page = 1): Promise<Paginated<PostedJob>> {
  const res = await request<Paginated<PostedJob> | PostedJob[]>('/api/v1/ats/b2b-posted-jobs/', { query: { page } });
  return toPage(res);
}

/** GET /api/v1/ats/application/job-pipeline/ (spec §4.2) — per-job counts per ApplicationStatus. */
export async function jobPipeline(page = 1): Promise<Paginated<PipelineRow>> {
  const res = await request<Paginated<PipelineRow> | PipelineRow[]>('/api/v1/ats/application/job-pipeline/', {
    query: { page },
  });
  return toPage(res);
}

/** GET /api/v1/ats/application/hiring-efficiency/ (spec §4.2). */
export async function hiringEfficiency(page = 1): Promise<Paginated<EfficiencyRow>> {
  const res = await request<Paginated<EfficiencyRow> | EfficiencyRow[]>('/api/v1/ats/application/hiring-efficiency/', {
    query: { page },
  });
  return toPage(res);
}

/** GET /api/v1/ats/application/hiring-data/ (spec §4.3, AllowAny) — hired-by-source/department aggregate, shape unknown. */
export async function hiringData(): Promise<HiringData> {
  return request<HiringData>('/api/v1/ats/application/hiring-data/', { anonymous: true });
}

/** GET /api/v1/ats/application/b2c-insights/?type= (spec §4.3, AllowAny). */
export async function b2cInsights(types: InsightType[]): Promise<unknown> {
  return request<unknown>('/api/v1/ats/application/b2c-insights/', { anonymous: true, query: { type: types } });
}
