import type { BillingCycle, UserType } from '@/shared/api';

/** Feature nested in a package (spec §7). */
export interface SubscriptionFeature {
  id: number;
  name: string;
  description: string | null;
  code: string;
  has_usage_limit: boolean;
  default_limit: number | null;
  credit_cost: number | null;
  is_premium: boolean;
  usages_status?: { usage_count: number; total_credits_used: number; last_used: string | null } | null;
}

export interface PackageFeature {
  feature: SubscriptionFeature;
  usage_limit: number | null;
  effective_limit: number | null;
  is_included: boolean;
  notes: string | null;
}

/** GET /api/v1/subscriptions/packages/ row (spec §7). Prices are decimal strings or numbers. */
export interface SubscriptionPackage {
  id: number;
  name: string;
  description: string | null;
  user_type: UserType;
  base_price: string | number;
  discount_percentage: string | number | null;
  discounted_price: string | number | null;
  is_featured: boolean;
  is_popular: boolean;
  has_trial: boolean;
  trial_days: number | null;
  included_credits: number | null;
  monthly_price: string | number | null;
  quarterly_price: string | number | null;
  biannually_price: string | number | null;
  annually_price: string | number | null;
  package_features: PackageFeature[];
}

/** GET /api/v1/subscriptions/user-subscriptions/current/ (spec §7). */
export interface UserSubscription {
  id: number | string;
  package: SubscriptionPackage;
  billing_cycle: BillingCycle | string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  trial_end_date: string | null;
  auto_renew: boolean;
  available_credits: number | null;
  is_active: boolean;
  is_trial: boolean;
  days_remaining: number | null;
}

/** POST …/create-subscription/ body — `promo_code` is deliberately absent (spec §11.2). */
export interface CreateCheckoutInput {
  package_id: number;
  billing_cycle: BillingCycle;
  auto_renew: boolean;
  success_url: string;
  cancel_url: string;
}

export interface CheckoutSession {
  session_id: string;
  payment_url: string;
}

/** GET /api/v1/subscriptions/payments/ row. */
export interface Payment {
  id: number | string;
  amount: string | number;
  currency: string;
  payment_type: string | null;
  status: string;
  billing_cycle: string | null;
  created_at: string;
}

/** GET /api/v1/subscriptions/feature-usage/history/ row. */
export interface FeatureUsage {
  feature_name: string;
  usage_cost: number | string | null;
  last_used: string | null;
  reset_period: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export function priceNumber(v: string | number | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Price for a billing cycle, falling back to base_price for monthly. */
export function packagePrice(p: SubscriptionPackage, cycle: BillingCycle): number | null {
  const map: Record<BillingCycle, string | number | null> = {
    monthly: p.monthly_price ?? p.base_price,
    quarterly: p.quarterly_price,
    biannually: p.biannually_price,
    annually: p.annually_price,
  };
  return priceNumber(map[cycle]);
}

export const isFreePackage = (p: SubscriptionPackage) => (priceNumber(p.base_price) ?? 0) === 0;
