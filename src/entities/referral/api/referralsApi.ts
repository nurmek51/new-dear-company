import { ApiError, request, type Paginated } from '@/shared/api';
import type { ReferralContact, ReferralProfile, ReferralProfileInput, Referrer } from '../model/types';

const base = '/api/v1/referrals';

export const referralsApi = {
  list: (company = '', page = 1) => request<Paginated<Referrer>>(`${base}/referrers/`, { anonymous: true, query: { company, page } }),
  async myProfile(): Promise<ReferralProfile | null> {
    try {
      return await request<ReferralProfile>(`${base}/my-profile/`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
  saveProfile: (data: ReferralProfileInput) => request<ReferralProfile>(`${base}/my-profile/`, { method: 'PUT', body: data }),
  deleteProfile: () => request<void>(`${base}/my-profile/`, { method: 'DELETE' }),
  contact: (id: string) => request<ReferralContact>(`${base}/referrers/${id}/contact/`),
};
