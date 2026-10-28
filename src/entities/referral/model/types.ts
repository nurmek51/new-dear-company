export interface Referrer {
  id: string;
  display_name: string;
  company: string;
  roles: string;
  quote: string;
  has_telegram: boolean;
  has_linkedin: boolean;
}

export interface ReferralProfileInput {
  display_name: string;
  company: string;
  roles: string;
  quote: string;
  telegram: string;
  linkedin: string;
}

export interface ReferralProfile extends ReferralProfileInput {
  id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReferralContact {
  telegram_url: string | null;
  linkedin_url: string | null;
}
