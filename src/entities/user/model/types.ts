import type { UserType } from '@/shared/api';

/** `CustomUserDetailsSerializer` (spec §1.9). Identity key is `pk`. */
export interface ApiUser {
  pk: string;
  email: string | null;
  phone_number: string | null;
  name: string;
  user_type: UserType;
  profile_picture: string | null;
  profile_picture_display: string | null;
  questionnaire_response_status: string;
  is_profile_initialized: boolean;
  profile_initialization_status: 'COMPLETED' | 'PENDING' | 'IN_PROGRESS' | 'FAILED' | string;
  is_owner: boolean;
  email_verified: boolean;
  phone_verified: boolean;
  resume_skip_status: 'not_started' | 'skipped' | 'completed' | 'processing' | 'manual' | string;
  enable_auto_apply: boolean;
  subscription: UserSubscriptionSummary | null;
}

/** Subset of UserSubscriptionSerializer (spec §7.2) embedded in the user. */
export interface UserSubscriptionSummary {
  id: number | string;
  package?: { id: number; name: string } | null;
  billing_cycle?: string;
  status?: string;
  end_date?: string | null;
  is_active?: boolean;
  is_trial?: boolean;
  days_remaining?: number;
  available_credits?: number;
}

export const isSeeker = (u: ApiUser | null) => !!u && u.user_type === 'b2c';
export const isRecruiter = (u: ApiUser | null) => !!u && u.user_type === 'b2b';
export const isStaff = (u: ApiUser | null) => !!u && u.user_type === 'staff';
