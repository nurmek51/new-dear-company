import { request, toPage, type Paginated } from '@/shared/api';
import { extractRows, toCandidateProfile, toPoolCandidate, toProfileMatch } from '../model/normalize';
import type { CandidateProfile, ListCandidatesParams, PoolCandidate, ProfileMatch } from '../model/types';

const PAGE_SIZE = 25;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * GET /api/v1/ats/candidates/ (spec §4.3) — public pool (AllowAny), paginated.
 * Nothing is cached: the endpoint exposes PII without auth (spec §11.9).
 */
export async function listCandidates(params: ListCandidatesParams = {}): Promise<Paginated<PoolCandidate>> {
  const res = await request<Paginated<unknown> | unknown[]>('/api/v1/ats/candidates/', {
    anonymous: true,
    query: { page_size: PAGE_SIZE, ...params },
  });
  const page = toPage(res);
  const results = page.results.map(toPoolCandidate).filter((r): r is PoolCandidate => !!r);
  return { ...page, count: Array.isArray(res) ? results.length : page.count, results };
}

/** GET /api/v1/ats/candidate-profile-by-profile-id/{profile_id}/ (spec §4.3, AllowAny); null on 404. */
export async function getCandidateProfile(profileId: string): Promise<CandidateProfile | null> {
  try {
    const payload = await request<unknown>(`/api/v1/ats/candidate-profile-by-profile-id/${profileId}/`, {
      anonymous: true,
    });
    return toCandidateProfile(isObj(payload) && isObj(payload.profile) ? payload.profile : payload);
  } catch (e) {
    if ((e as { status?: number }).status === 404) return null;
    throw e;
  }
}

/** GET /api/v1/ai-match-engine/match-profiles/{job_id}/?n= (spec §5) — top candidates for a job. */
export async function matchProfilesForJob(jobId: string, n = 10): Promise<ProfileMatch[]> {
  const payload = await request<unknown>(`/api/v1/ai-match-engine/match-profiles/${jobId}/`, {
    query: { n },
    timeoutMs: 120_000,
  });
  return extractRows(payload).map(toProfileMatch).filter((r): r is ProfileMatch => !!r);
}

/** GET /api/v1/ai-match-engine/ai-search-profiles/?q= (spec §5) — semantic candidate search. */
export async function aiSearchProfiles(q: string, n = 20): Promise<PoolCandidate[]> {
  const payload = await request<unknown>('/api/v1/ai-match-engine/ai-search-profiles/', {
    query: { q, n },
    timeoutMs: 120_000,
  });
  return extractRows(payload)
    .map((row) => (isObj(row) && isObj(row.profile) ? { ...row.profile, ...(typeof row.score === 'number' ? { score: row.score } : {}) } : row))
    .map(toPoolCandidate)
    .filter((r): r is PoolCandidate => !!r);
}
