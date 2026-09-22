import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, View, type ViewStyle } from 'react-native';
import {
  cancel as cancelSubscription,
  createCheckout,
  getCurrent,
  isFreePackage,
  listPackages,
  listPayments,
  packagePrice,
  type Payment,
  type SubscriptionPackage,
  type UserSubscription,
} from '@/entities/subscription';
import { useAuth } from '@/entities/user';
import { ApiError, type BillingCycle } from '@/shared/api';
import { useBreakpoint } from '@/shared/lib/responsive';
import { useT } from '@/shared/lib/useT';
import { accent, link, useTheme } from '@/shared/theme';
import { Overlay, Txt } from '@/shared/ui';

/**
 * Plans & pricing (Recruiter ATS prototype 724–788). KEPT: header, 3-column
 * plan cards with badge / price / feature ticks / CTA, billing card, telegram
 * tip. ADAPTED: cards come from GET packages?user_type=b2b (§7), the
 * monthly/yearly toggle maps to monthly_price / annually_price, CTA starts a
 * Stripe Checkout (create-subscription → payment_url), billing card reads
 * user-subscriptions/current + payments; "cancel" turns auto-renew off
 * (cancel/ endpoint) after a confirm. HIDDEN: card on file / change card /
 * seats (not in the contract), invoice pdf download (no endpoint), promo
 * code (§11.2), paypal (§11.3), pay-now (§11.6).
 */
type Cycle = 'monthly' | 'annually';

function fmtMoney(n: number | null, currency = 'USD'): string {
  if (n == null) return '—';
  const sym = { USD: '$', EUR: '€', GBP: '£' }[currency] ?? `${currency} `;
  return `${sym}${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase();
}

function returnUrl(result: 'success' | 'cancel'): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/recruiter/pricing?checkout=${result}`;
  }
  return Linking.createURL('/recruiter/pricing', { queryParams: { checkout: result } });
}

function Tile({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 140, backgroundColor: t.bg, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, gap: 3 }}>
      <Txt size={11} color={t.mut2}>{label}</Txt>
      <Txt size={13} weight="700" mono={mono}>{value}</Txt>
    </View>
  );
}

export function RecruiterPricingPage() {
  const t = useTheme();
  const tr = useT();
  const bp = useBreakpoint();
  const params = useLocalSearchParams<{ checkout?: string }>();
  const reloadUser = useAuth((s) => s.reloadUser);

  const [packages, setPackages] = useState<SubscriptionPackage[] | null>(null);
  const [current, setCurrent] = useState<UserSubscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pk, cur, pay] = await Promise.all([
        listPackages('b2b'),
        getCurrent(),
        listPayments().then((p) => p.results).catch(() => [] as Payment[]),
      ]);
      setPackages(pk);
      setCurrent(cur);
      setPayments(pay);
      if (cur?.billing_cycle === 'annually') setCycle('annually');
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.isNetworkError
            ? tr('could not reach the server. check your connection and retry.')
            : e.message
          : tr('could not load plans. check your connection and retry.'),
      );
    } finally {
      setLoading(false);
    }
  }, [tr]);

  useEffect(() => {
    let cancelled = false;
    (async () => { if (!cancelled) await load(); })();
    return () => { cancelled = true; };
  }, [load]);

  useEffect(() => {
    if (params.checkout === 'success') {
      setNotice(tr('checkout finished. your plan updates as soon as stripe confirms the payment — refresh if it is not here yet.'));
      reloadUser();
    } else if (params.checkout === 'cancel') {
      setNotice(tr('checkout cancelled — nothing was charged.'));
    }
  }, [params.checkout, reloadUser, tr]);

  const startCheckout = useCallback(async (p: SubscriptionPackage) => {
    if (busyId != null) return;
    setBusyId(p.id);
    setError(null);
    try {
      const billing_cycle: BillingCycle = cycle;
      const session = await createCheckout({
        package_id: p.id,
        billing_cycle,
        auto_renew: true,
        success_url: returnUrl('success'),
        cancel_url: returnUrl('cancel'),
      });
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.assign(session.payment_url);
      } else {
        await Linking.openURL(session.payment_url);
      }
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.isNetworkError
            ? tr('could not reach the server. check your connection and retry.')
            : e.message
          : tr('could not start checkout. please try again.'),
      );
    } finally {
      setBusyId(null);
    }
  }, [busyId, cycle, tr]);

  const doCancel = useCallback(async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      const res = await cancelSubscription();
      setConfirmCancel(false);
      setNotice(res.message || tr('auto-renewal cancelled.'));
      await load();
      await reloadUser();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.isNetworkError
            ? tr('could not reach the server. check your connection and retry.')
            : e.message
          : tr('could not cancel. please try again.'),
      );
    } finally {
      setCancelling(false);
    }
  }, [cancelling, load, reloadUser, tr]);

  const gutter = bp.isMobile ? 12 : 26;
  const currentId = current?.is_active ? current.package.id : null;
  const cycleLabel = cycle === 'monthly' ? tr('per month') : tr('per year');

  const cards = (packages ?? []).map((p) => {
    const isCurrent = currentId === p.id;
    const price = packagePrice(p, cycle);
    const free = isFreePackage(p);
    const badge = isCurrent ? tr('current plan') : p.is_popular ? tr('popular') : p.is_featured ? tr('featured') : null;
    const feats = p.package_features.filter((f) => f.is_included);
    const busy = busyId === p.id;
    const highlighted = p.is_popular || p.is_featured;
    const clickable = !isCurrent && !free;
    const btnLabel = isCurrent ? tr('your current plan') : free ? tr('free — no checkout needed') : busy ? tr('opening checkout…') : `${tr('switch to')} ${p.name.toLowerCase()}`;
    return (
      <View key={p.id} style={{ flex: 1, minWidth: bp.isMobile ? '100%' : 260, backgroundColor: t.card, borderWidth: 2, borderColor: isCurrent ? t.ink : t.l10, borderRadius: 16, padding: 22, gap: 14, position: 'relative' }}>
        {badge && (
          <View style={{ position: 'absolute', top: -10, left: 20, backgroundColor: accent, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 9 }}>
            <Txt size={10.5} weight="700" color="#101114">{badge}</Txt>
          </View>
        )}
        <View>
          <Txt size={14} weight="700">{p.name.toLowerCase()}</Txt>
          {p.description ? <Txt size={12} color={t.mut} style={{ marginTop: 2 }}>{p.description}</Txt> : null}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
            <Txt size={30} weight="700" ls={-0.03}>{fmtMoney(price)}</Txt>
            <Txt size={12} color={t.mut}>{free ? tr('forever') : cycleLabel}</Txt>
          </View>
          {p.has_trial && p.trial_days ? <Txt size={11.5} color={t.mut}>{p.trial_days} {tr('day trial')}</Txt> : null}
        </View>
        <View style={{ gap: 8 }}>
          {feats.map((f) => (
            <View key={f.feature.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 15, height: 15, borderRadius: 8, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
                <Txt size={9} color="#101114">✓</Txt>
              </View>
              <Txt size={12.5} color={t.ink2} style={{ flex: 1 }}>
                {f.feature.name.toLowerCase()}{f.effective_limit != null ? ` · ${f.effective_limit}` : ''}
              </Txt>
            </View>
          ))}
          {!feats.length && <Txt size={12.5} color={t.mut}>{tr('no itemized features')}</Txt>}
        </View>
        <Pressable
          onPress={clickable && !busy ? () => startCheckout(p) : undefined}
          accessibilityRole="button"
          accessibilityState={{ disabled: !clickable, busy }}
          style={{
            marginTop: 'auto',
            alignItems: 'center',
            paddingVertical: 10,
            borderRadius: 9,
            borderWidth: 1,
            backgroundColor: !clickable ? t.card : highlighted ? '#141519' : t.card,
            borderColor: !clickable ? t.l15 : highlighted ? '#141519' : t.l25,
            ...(clickable ? null : { cursor: 'default' }),
          } as ViewStyle}
        >
          <Txt size={13} weight="600" color={!clickable ? t.mut : highlighted ? accent : t.ink}>{btnLabel}</Txt>
        </Pressable>
      </View>
    );
  });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ paddingBottom: 30 }}>
      <View style={{ maxWidth: 960, width: '100%', alignSelf: 'center', paddingVertical: 30, paddingHorizontal: gutter }}>
        <Txt size={bp.isMobile ? 22 : 24} weight="700" ls={-0.03}>{tr('plans & pricing')}</Txt>
        <Txt size={13} color={t.mut} style={{ marginTop: 4 }}>{tr('start small, upgrade when hiring grows')}</Txt>

        <View style={{ flexDirection: 'row', gap: 6, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {(['monthly', 'annually'] as Cycle[]).map((c) => {
            const on = cycle === c;
            return (
              <Pressable key={c} onPress={() => setCycle(c)} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ borderRadius: 999, paddingVertical: 6, paddingHorizontal: 13, backgroundColor: on ? '#141519' : t.card, borderWidth: 1, borderColor: on ? '#141519' : t.l12 }}>
                <Txt size={12} weight="600" color={on ? accent : t.ink}>{c === 'monthly' ? tr('monthly') : tr('yearly')}</Txt>
              </Pressable>
            );
          })}
        </View>

        {notice && (
          <View style={{ marginTop: 14, backgroundColor: '#DCF2E3', borderRadius: 12, padding: 13 }} accessibilityLiveRegion="polite">
            <Txt size={12.5} weight="600" color="#166534">{notice}</Txt>
          </View>
        )}
        {error && (
          <View style={{ marginTop: 14, backgroundColor: '#FDE2E2', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }} accessibilityLiveRegion="polite">
            <Txt size={12.5} weight="600" color="#b91c1c" style={{ flex: 1 }}>{error}</Txt>
            <Pressable onPress={load} accessibilityRole="button" style={{ backgroundColor: '#141519', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 13 }}>
              <Txt size={12} weight="700" color={accent}>{tr('retry')}</Txt>
            </Pressable>
          </View>
        )}

        {loading && !packages ? (
          <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={t.ink} /></View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 20 }}>
            {cards.length ? (
              cards
            ) : packages == null ? (
              <View style={{ flex: 1, minWidth: '100%', backgroundColor: t.card, borderWidth: 1, borderColor: t.l10, borderRadius: 16, paddingVertical: 24, paddingHorizontal: 22, gap: 10, alignItems: 'flex-start' }}>
                <Txt size={13.5} weight="700">{tr('plans could not be loaded')}</Txt>
                <Txt size={12.5} color={t.mut} lh={1.5}>{error ?? tr('could not load plans. check your connection and retry.')}</Txt>
                <Pressable onPress={load} accessibilityRole="button" style={{ backgroundColor: '#141519', borderRadius: 9, paddingVertical: 9, paddingHorizontal: 15 }}>
                  <Txt size={12.5} weight="700" color={accent}>{tr('retry')}</Txt>
                </Pressable>
              </View>
            ) : (
              <View style={{ flex: 1, minWidth: '100%', backgroundColor: t.card, borderWidth: 1, borderColor: t.l10, borderRadius: 16, paddingVertical: 24, paddingHorizontal: 22, gap: 6 }}>
                <Txt size={13.5} weight="700">{tr('no plans are published yet')}</Txt>
                <Txt size={12.5} color={t.mut} lh={1.5}>{tr('there is nothing to subscribe to right now. posting jobs and the pipeline keep working — write to us in telegram if you expected a plan here.')}</Txt>
              </View>
            )}
          </View>
        )}

        {current && (
          <View style={{ backgroundColor: t.card, borderWidth: 1, borderColor: t.l10, borderRadius: 16, paddingVertical: 22, paddingHorizontal: 24, marginTop: 18, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <Txt size={15} weight="700">{tr('billing')}</Txt>
              <View style={{ marginLeft: 'auto', backgroundColor: current.auto_renew ? '#DCF2E3' : '#FFF3C4', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 }}>
                <Txt size={11.5} weight="700" color={current.auto_renew ? '#166534' : '#92400e'}>
                  {current.is_trial ? tr('trial') : current.auto_renew ? tr(current.status || 'active') : tr('ends at period end')}
                </Txt>
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <Tile label={tr('plan')} value={`${current.package.name.toLowerCase()} · ${tr(String(current.billing_cycle))}`} />
              <Tile label={current.auto_renew ? tr('renews on') : tr('access until')} value={fmtDate(current.end_date)} />
              <Tile label={tr('days remaining')} value={current.days_remaining == null ? '—' : `${current.days_remaining}`} mono />
              <Tile label={tr('credits')} value={current.available_credits == null ? '—' : `${current.available_credits}`} mono />
            </View>
            {payments.length > 0 && (
              <View style={{ borderWidth: 1, borderColor: t.l09, borderRadius: 12, overflow: 'hidden' }}>
                {payments.map((inv, i) => (
                  <View key={String(inv.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 14, backgroundColor: t.card, borderTopWidth: i ? 1 : 0, borderTopColor: t.l06 }}>
                    <Txt size={12.5} mono color={t.mut} style={{ flex: 1.2 }} numberOfLines={1}>#{String(inv.id)}</Txt>
                    <Txt size={12.5} style={{ flex: 1 }}>{fmtDate(inv.created_at)}</Txt>
                    <Txt size={12.5} weight="700" style={{ flex: 1 }}>{fmtMoney(Number(inv.amount), inv.currency)}</Txt>
                    <Txt size={12} weight="600" color={t.mut}>{String(inv.status).toLowerCase()}</Txt>
                  </View>
                ))}
              </View>
            )}
            {current.auto_renew ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Pressable onPress={() => setConfirmCancel(true)} accessibilityRole="button" style={{ marginLeft: 'auto', borderWidth: 1, borderColor: '#FDE2E2', borderRadius: 9, paddingVertical: 9, paddingHorizontal: 15, backgroundColor: t.card }}>
                  <Txt size={12.5} weight="600" color="#b91c1c">{tr('cancel auto-renewal')}</Txt>
                </Pressable>
              </View>
            ) : (
              <Txt size={12} color={t.mut}>{tr('auto-renewal is off — your plan stays active until the period ends, then nothing is charged.')}</Txt>
            )}
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <View style={{ backgroundColor: t.chip, borderRadius: 5, paddingVertical: 3, paddingHorizontal: 7 }}>
            <Txt size={11} mono>{tr('tip')}</Txt>
          </View>
          <Txt size={12.5} color={t.mut}>{tr('questions about plans? write us —')} </Txt>
          <Pressable onPress={() => Linking.openURL('https://t.me/emilymelien')} accessibilityRole="link">
            <Txt size={12.5} weight="600" color={link}>@emilymelien</Txt>
          </Pressable>
          <Txt size={12.5} color={t.mut}>{tr('in telegram.')}</Txt>
        </View>
      </View>

      <Overlay visible={confirmCancel} onClose={() => (cancelling ? undefined : setConfirmCancel(false))} width={420}>
        <Txt size={17} weight="700" ls={-0.02}>{tr('cancel auto-renewal?')}</Txt>
        <Txt size={13} color={t.ink3} lh={1.6} style={{ marginTop: 10 }}>
          {tr('your plan stays active until')} {fmtDate(current?.end_date)}. {tr('after that it will not renew and nothing is charged. nothing is deleted.')}
        </Txt>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <Pressable onPress={() => setConfirmCancel(false)} disabled={cancelling} accessibilityRole="button" style={{ borderWidth: 1, borderColor: t.l15, borderRadius: 9, paddingVertical: 9, paddingHorizontal: 15 }}>
            <Txt size={12.5} weight="600">{tr('keep my plan')}</Txt>
          </Pressable>
          <Pressable onPress={doCancel} disabled={cancelling} accessibilityRole="button" accessibilityState={{ busy: cancelling }} style={{ backgroundColor: '#b91c1c', borderRadius: 9, paddingVertical: 9, paddingHorizontal: 15, opacity: cancelling ? 0.7 : 1 }}>
            <Txt size={12.5} weight="700" color="#F6F4EE">{cancelling ? tr('cancelling…') : tr('yes, stop renewing')}</Txt>
          </Pressable>
        </View>
      </Overlay>
    </ScrollView>
  );
}
