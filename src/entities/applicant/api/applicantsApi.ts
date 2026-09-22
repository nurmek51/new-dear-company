import { request, toPage, type Paginated } from '@/shared/api';
import { parseApplicantsResponse } from '../model/stages';
import type {
  ApplicantsPage,
  B2BTrackingRow,
  ListApplicantsParams,
  RecruiterStatusUpdate,
  TrackingPatch,
} from '../model/types';

const PAGE_SIZE = 50;

/**
 * GET /api/v1/ats/job/{id}/applicants/ (spec §4.2, B2B) — the response merges the
 * paginated rows with a status-count summary, so it is parsed defensively.
 */
export async function listApplicants(jobId: string, params: ListApplicantsParams = {}): Promise<ApplicantsPage> {
  const payload = await request<unknown>(`/api/v1/ats/job/${jobId}/applicants/`, {
    query: { page_size: PAGE_SIZE, ...params },
  });
  return parseApplicantsResponse(payload);
}

/** POST /api/v1/ats/applications/{id}/update-status/ (spec §4.2, B2B; cannot set withdrawn). */
export async function updateStatus(applicationId: string, input: RecruiterStatusUpdate): Promise<unknown> {
  return request<unknown>(`/api/v1/ats/applications/${applicationId}/update-status/`, {
    method: 'POST',
    body: { status: input.status, notes: input.notes ?? '', action: input.action ?? '' },
  });
}

/** GET /api/v1/ats/applications/{id}/b2b-tracking/ (spec §4.2) — log with actor_name. */
export async function getTracking(applicationId: string): Promise<B2BTrackingRow[]> {
  const res = await request<Paginated<B2BTrackingRow> | B2BTrackingRow[]>(
    `/api/v1/ats/applications/${applicationId}/b2b-tracking/`,
  );
  const rows = toPage(res).results;
  return [...rows].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
}

/** PATCH /api/v1/ats/applications/{id}/tracking/{tracking_id}/edit/ (spec §4.2). */
export async function editTracking(applicationId: string, trackingId: string, patch: TrackingPatch): Promise<B2BTrackingRow> {
  return request<B2BTrackingRow>(`/api/v1/ats/applications/${applicationId}/tracking/${trackingId}/edit/`, {
    method: 'PATCH',
    body: patch,
  });
}
