import { ApiError, request, toPage, type Paginated } from '@/shared/api';
import type {
  CheckoutSession,
  CreateCheckoutInput,
  FeatureUsage,
  Payment,
  SubscriptionPackage,
  UserSubscription,
} from '../model/types';

const BASE = '/api/v1/subscriptions';

/** GET /api/v1/subscriptions/packages/?user_type=… (spec §7, AllowAny). */
export async function listPackages(user_type: 'b2c' | 'b2b'): Promise<SubscriptionPackage[]> {
  const res = await request<Paginated<SubscriptionPackage> | SubscriptionPackage[]>(`${BASE}/packages/`, {
    anonymous: true,
    query: { user_type },
  });
  return toPage(res).results;
}

/** GET …/user-subscriptions/current/ — null when the API answers 404 ("No active subscription found", spec §7). */
export async function getCurrent(): Promise<UserSubscription | null> {
  try {
    return await request<UserSubscription>(`${BASE}/user-subscriptions/current/`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/** POST …/user-subscriptions/create-subscription/ → Stripe-hosted checkout. Never sends promo_code (spec §11.2). */
export async function createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
  const body: CreateCheckoutInput = {
    package_id: input.package_id,
    billing_cycle: input.billing_cycle,
    auto_renew: input.auto_renew,
    success_url: input.success_url,
    cancel_url: input.cancel_url,
  };
  return request<CheckoutSession>(`${BASE}/user-subscriptions/create-subscription/`, { method: 'POST', body });
}

/** POST …/user-subscriptions/cancel/ — turns auto-renew off at period end. */
export async function cancel(): Promise<{ message: string }> {
  return request<{ message: string }>(`${BASE}/user-subscriptions/cancel/`, { method: 'POST' });
}

/** GET …/payments/ — the caller's payment history. */
export async function listPayments(page = 1): Promise<Paginated<Payment>> {
  const res = await request<Paginated<Payment> | Payment[]>(`${BASE}/payments/`, { query: { page } });
  return toPage(res);
}

/** GET …/feature-usage/history/ (paginated). */
export async function listFeatureUsage(page = 1): Promise<Paginated<FeatureUsage>> {
  const res = await request<Paginated<FeatureUsage> | FeatureUsage[]>(`${BASE}/feature-usage/history/`, {
    query: { page },
  });
  return toPage(res);
}
