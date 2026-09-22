import * as ExpoLinking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import {
  isFreePackage,
  packagePrice,
  subscriptionApi,
  type Payment,
  type SubscriptionPackage,
  type UserSubscription,
} from '@/entities/subscription';
import { useAuth } from '@/entities/user';
import { ApiError, currencyLabel, errorMessageFrom, humanize, type BillingCycle } from '@/shared/api';
import { useBreakpoint } from '@/shared/lib/responsive';
import { useT } from '@/shared/lib/useT';
import { accent, accentInk, danger, useTheme } from '@/shared/theme';
import { Txt } from '@/shared/ui';

/** Stripe accepts only http(s) return URLs, so native builds return to the web origin (EXPO_PUBLIC_WEB_ORIGIN) when set. */
function returnUrl(result: 'success' | 'cancel'): string {
  const path = `/plus?checkout=${result}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}${path}`;
  const webOrigin = process.env.EXPO_PUBLIC_WEB_ORIGIN?.trim().replace(/\/+$/, '');
  if (webOrigin) return `${webOrigin}${path}`;
  return ExpoLinking.createURL('/plus', { queryParams: { checkout: result } });
}

function messageOf(e: unknown, fallback: string, offline?: string): string {
  if (e instanceof ApiError) return e.isNetworkError && offline ? offline : e.message;
  if (e instanceof Error) return e.message;
  return errorMessageFrom(e, fallback);
}

function money(n: number | null, currency = 'EUR'): string {
  if (n == null) return '—';
  const sym = currencyLabel(currency);
  const v = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return sym.length === 1 || sym.endsWith('$') ? `${sym}${v}` : `${v} ${sym}`;
}

function dateText(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase();
}

/** /plus — public pricing page (design lines 566–628). Checkout is Stripe-hosted (spec §7); no in-app card form. */
export function PlusPage() {
  const t = useTheme();
  const tr = useT();
  const bp = useBreakpoint();
  const router = useRouter();
  const { checkout } = useLocalSearchParams<{ checkout?: string }>();
  const status = useAuth((s) => s.status);
  const reloadUser = useAuth((s) => s.reloadUser);
  const signedIn = status === 'signedIn';
  const alive = useRef(true);

  const [packages, setPackages] = useState<SubscriptionPackage[] | null>(null);
  const [pkgError, setPkgError] = useState<string | null>(null);
  const [current, setCurrent] = useState<UserSubscription | null | undefined>(undefined);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [busy, setBusy] = useState(false);
  const [ctaError, setCtaError] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelNote, setCancelNote] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const offline = tr('could not reach the server. check your connection and try again.');

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const loadPackages = useCallback(async () => {
    setPkgError(null);
    setPackages(null);
    try {
      const rows = await subscriptionApi.listPackages('b2c');
      if (alive.current) setPackages(rows);
    } catch (e) {
      if (!alive.current) return;
      setPkgError(messageOf(e, tr('could not load the plans'), offline));
      setPackages([]);
    }
  }, [offline, tr]);

  const loadAccount = useCallback(async () => {
    if (!signedIn) {
      setCurrent(null);
      setPayments(null);
      return;
    }
    setCurrent(undefined);
    setPayments(null);
    setPaymentsError(null);
    const [cur, pay] = await Promise.allSettled([subscriptionApi.getCurrent(), subscriptionApi.listPayments()]);
    if (!alive.current) return;
    setCurrent(cur.status === 'fulfilled' ? cur.value : null);
    if (pay.status === 'fulfilled') setPayments(pay.value.results);
    else {
      setPayments([]);
      setPaymentsError(messageOf(pay.reason, tr('could not load payments'), offline));
    }
  }, [offline, signedIn, tr]);

  useEffect(() => {
    void loadPackages();
  }, [loadPackages]);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  useEffect(() => {
    if (checkout === 'success') {
      setBanner(tr('checkout finished — refreshing your plan. it can take a moment for stripe to confirm.'));
      void reloadUser().catch(() => undefined);
      void loadAccount();
    } else if (checkout === 'cancel') {
      setBanner(tr('checkout cancelled — nothing was charged.'));
    }
  }, [checkout, loadAccount, reloadUser, tr]);

  const freePkg = packages?.find(isFreePackage) ?? null;
  const plusPkg = packages?.find((p) => !isFreePackage(p)) ?? null;
  const hasMonthly = plusPkg ? packagePrice(plusPkg, 'monthly') != null : false;
  const hasAnnual = plusPkg ? packagePrice(plusPkg, 'annually') != null : false;
  const effectiveCycle: BillingCycle = cycle === 'annually' && hasAnnual ? 'annually' : hasMonthly ? 'monthly' : 'annually';
  const price = plusPkg ? packagePrice(plusPkg, effectiveCycle) : null;
  const monthly = plusPkg ? packagePrice(plusPkg, 'monthly') : null;
  const annual = plusPkg ? packagePrice(plusPkg, 'annually') : null;
  const yearlySaving = monthly != null && annual != null ? Math.round(monthly * 12 - annual) : null;
  const included = (p: SubscriptionPackage) => p.package_features.filter((f) => f.is_included);

  const startCheckout = async () => {
    if (!plusPkg || busy) return;
    if (!signedIn) {
      router.push('/sign-in' as never);
      return;
    }
    setBusy(true);
    setCtaError(null);
    try {
      const session = await subscriptionApi.createCheckout({
        package_id: plusPkg.id,
        billing_cycle: effectiveCycle,
        auto_renew: true,
        success_url: returnUrl('success'),
        cancel_url: returnUrl('cancel'),
      });
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.assign(session.payment_url);
      else await Linking.openURL(session.payment_url);
    } catch (e) {
      if (alive.current) setCtaError(messageOf(e, tr('could not start checkout'), offline));
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const cancelRenewal = async () => {
    if (busy) return;
    setBusy(true);
    setCtaError(null);
    try {
      const res = await subscriptionApi.cancel();
      if (!alive.current) return;
      setCancelConfirm(false);
      setCancelNote(res.message);
      await loadAccount();
    } catch (e) {
      if (alive.current) setCtaError(messageOf(e, tr('could not cancel auto-renew'), offline));
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const g = bp.gutter;
  const h1 = bp.isMobile ? 29 : 46;
  const onPlan = !!current && current.is_active;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
      <View style={{ width: '100%', maxWidth: 880, alignSelf: 'center', paddingTop: 38, paddingHorizontal: g, gap: 18 }}>
        <Txt size={h1} weight="700" lh={1.05} ls={-0.04} accessibilityRole="header">
          {tr('job hunting on hard mode?')}{'\n'}
          {tr("there's")}{' '}
          <View style={{ backgroundColor: accent, borderRadius: 10, paddingHorizontal: 14, transform: [{ rotate: '-1.2deg' }] }}>
            <Txt size={h1} weight="700" lh={1.05} ls={-0.04} color={accentInk}>{tr('plus ✦')}</Txt>
          </View>
        </Txt>
        <Txt size={bp.isMobile ? 14 : 15.5} color={t.mut} lh={1.6} style={{ maxWidth: 540 }}>
          {tr('browsing, applying and tracking stay free. plus unlocks the paid features listed below — billed through stripe, auto-renew can be switched off any time.')}
        </Txt>

        {banner && (
          <View style={{ backgroundColor: t.greenbg, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Txt size={13} weight="600" color={t.green} style={{ flex: 1 }}>{banner}</Txt>
            <Pressable onPress={() => setBanner(null)} accessibilityRole="button" accessibilityLabel={tr('dismiss')}>
              <Txt size={13} weight="700" color={t.green}>✕</Txt>
            </Pressable>
          </View>
        )}

        {packages === null && (
          <View style={{ paddingVertical: 40, alignItems: 'center', gap: 10 }}>
            <ActivityIndicator color={t.mut} />
            <Txt size={13} color={t.mut2}>{tr('loading plans…')}</Txt>
          </View>
        )}
        {packages !== null && pkgError && (
          <View style={{ backgroundColor: t.card, borderRadius: 22, padding: 26, gap: 10, alignItems: 'flex-start' }}>
            <Txt size={13.5} weight="600" color={danger}>{pkgError}</Txt>
            <Pressable onPress={() => void loadPackages()} accessibilityRole="button" style={{ backgroundColor: t.chip, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 }}>
              <Txt size={12.5} weight="700">{tr('try again')}</Txt>
            </Pressable>
          </View>
        )}
        {packages !== null && !pkgError && !plusPkg && (
          <View style={{ backgroundColor: t.card, borderRadius: 22, padding: 26, gap: 6 }}>
            <Txt size={15} weight="700">{tr('no paid plan is on sale right now')}</Txt>
            <Txt size={13.5} color={t.mut}>{tr('everything you can do today is free. check back later.')}</Txt>
          </View>
        )}

        {packages !== null && !pkgError && plusPkg && (
          <View style={{ flexDirection: bp.isMobile ? 'column' : 'row', gap: 16, marginTop: 6 }}>
            {/* free */}
            <View style={{ flex: bp.isMobile ? undefined : 1, backgroundColor: t.card, borderRadius: 22, padding: 26, gap: 16, shadowColor: '#141519', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 }}>
              <View>
                <Txt size={15} weight="700">{freePkg ? freePkg.name.toLowerCase() : tr('free')}</Txt>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
                  <Txt size={34} weight="700" ls={-0.03}>{money(0)}</Txt>
                  <Txt size={13} color={t.mut}>{tr('forever, actually')}</Txt>
                </View>
              </View>
              <View style={{ gap: 9 }}>
                {freePkg && included(freePkg).length > 0 ? (
                  included(freePkg).map((f) => (
                    <Txt key={f.feature.id} size={13.5} color={t.ink2}>{`✓ ${f.feature.name.toLowerCase()}`}</Txt>
                  ))
                ) : (
                  <Txt size={13.5} color={t.ink2}>{`✓ ${tr('browse & apply')}`}</Txt>
                )}
              </View>
              <View style={{ marginTop: 'auto', paddingVertical: 12, borderRadius: 12, backgroundColor: t.chip, alignItems: 'center' }}>
                <Txt size={13.5} weight="600" color={t.mut}>{onPlan ? tr('the free tier, always there') : tr("you're here — and that's fine")}</Txt>
              </View>
            </View>

            {/* plus */}
            <View style={{ flex: bp.isMobile ? undefined : 1, backgroundColor: '#141519', borderRadius: 22, padding: 26, gap: 16 }}>
              {(plusPkg.is_featured || plusPkg.is_popular) && (
                <View style={{ position: 'absolute', top: -11, left: 22, backgroundColor: accent, borderRadius: 7, paddingVertical: 3, paddingHorizontal: 10, transform: [{ rotate: '-1.5deg' }] }}>
                  <Txt size={11} weight="700" color={accentInk}>{plusPkg.is_popular ? tr('most popular') : tr('for the serious weeks')}</Txt>
                </View>
              )}
              <View>
                <Txt size={15} weight="700" color={accent}>{`${plusPkg.name.toLowerCase()} ✦`}</Txt>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
                  <Txt size={34} weight="700" ls={-0.03} color="#F6F4EE">{money(price)}</Txt>
                  <Txt size={13} color="#a1a1aa">{effectiveCycle === 'annually' ? tr('per year · auto-renew off any time') : tr('per month · auto-renew off any time')}</Txt>
                </View>
              </View>
              {hasMonthly && hasAnnual && (
                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', gap: 7 }}>
                    {(['monthly', 'annually'] as BillingCycle[]).map((c) => {
                      const act = effectiveCycle === c;
                      const p = packagePrice(plusPkg, c);
                      return (
                        <Pressable
                          key={c}
                          onPress={() => setCycle(c)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: act }}
                          style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10, backgroundColor: act ? accent : 'transparent', borderWidth: 1.5, borderColor: act ? accent : '#3f3f46' }}
                        >
                          <Txt size={12.5} weight="600" color={act ? accentInk : '#d4d4d8'}>{`${tr(c === 'monthly' ? 'monthly' : 'yearly')} · ${money(p)}`}</Txt>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Txt size={11.5} color="#a1a1aa">
                    {effectiveCycle === 'annually'
                      ? tr('billed once a year')
                      : yearlySaving != null && yearlySaving > 0
                        ? `${tr('switch to yearly and save')} ${money(yearlySaving)}`
                        : tr('billed every month')}
                  </Txt>
                </View>
              )}
              <View style={{ gap: 9 }}>
                {included(plusPkg).map((f) => (
                  <Txt key={f.feature.id} size={13.5} color="#d4d4d8">
                    <Txt size={13.5} color={accent}>✦</Txt>{` ${f.feature.name.toLowerCase()}`}
                    {f.effective_limit != null && f.feature.has_usage_limit ? ` · ${f.effective_limit} ${tr('per period')}` : ''}
                  </Txt>
                ))}
                {plusPkg.has_trial && plusPkg.trial_days ? (
                  <Txt size={13.5} color="#d4d4d8"><Txt size={13.5} color={accent}>✦</Txt>{` ${plusPkg.trial_days} ${tr('day free trial')}`}</Txt>
                ) : null}
                {plusPkg.included_credits ? (
                  <Txt size={13.5} color="#d4d4d8"><Txt size={13.5} color={accent}>✦</Txt>{` ${plusPkg.included_credits} ${tr('credits included')}`}</Txt>
                ) : null}
              </View>
              {ctaError && (
                <View style={{ backgroundColor: '#FDE2E2', borderRadius: 11, paddingVertical: 10, paddingHorizontal: 13 }}>
                  <Txt size={12.5} weight="600" color={danger}>{ctaError}</Txt>
                </View>
              )}
              {onPlan ? (
                <View style={{ marginTop: 'auto', paddingVertical: 13, borderRadius: 12, backgroundColor: '#23252B', alignItems: 'center' }}>
                  <Txt size={14} weight="700" color={accent}>{`${tr("you're on")} ${current?.package.name.toLowerCase()} ✦`}</Txt>
                </View>
              ) : (
                <Pressable
                  onPress={() => void startCheckout()}
                  disabled={busy || current === undefined}
                  accessibilityRole="button"
                  style={(state) => ({ marginTop: 'auto', paddingVertical: 13, borderRadius: 12, backgroundColor: accent, alignItems: 'center', opacity: busy || (state as { hovered?: boolean }).hovered ? 0.9 : 1 })}
                >
                  <Txt size={14} weight="700" color={accentInk}>
                    {busy
                      ? tr('opening checkout…')
                      : !signedIn
                        ? tr('sign in to get plus')
                        : `${tr('get')} ${plusPkg.name.toLowerCase()} — ${money(price)}${effectiveCycle === 'annually' ? tr('/yr') : tr('/mo')}`}
                  </Txt>
                </Pressable>
              )}
              {!onPlan && signedIn && (
                <Txt size={11.5} color="#a1a1aa" align="center" lh={1.5}>{tr('you will be sent to a stripe-hosted page to pay. no card details are entered here.')}</Txt>
              )}
            </View>
          </View>
        )}

        {/* current subscription */}
        {signedIn && current === undefined && (
          <View style={{ paddingVertical: 12, alignItems: 'center' }}>
            <ActivityIndicator color={t.mut} />
          </View>
        )}
        {signedIn && current && (
          <View style={{ backgroundColor: t.card, borderRadius: 20, paddingVertical: 22, paddingHorizontal: 24, gap: 14, shadowColor: '#141519', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <Txt size={15} weight="700" style={{ flex: 1 }}>{tr('your subscription')}</Txt>
              <View style={{ backgroundColor: current.auto_renew && current.is_active ? t.greenbg : t.oc1bg, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 }}>
                <Txt size={11.5} weight="700" color={current.auto_renew && current.is_active ? t.green : t.oc1}>
                  {current.is_trial ? tr('trial') : current.auto_renew ? tr('active') : tr('ends at period end')}
                </Txt>
              </View>
            </View>
            <View style={{ flexDirection: bp.isMobile ? 'column' : 'row', gap: 10 }}>
              {[
                { k: tr('plan'), v: `${current.package.name.toLowerCase()} ✦ · ${humanize(String(current.billing_cycle))}` },
                { k: current.auto_renew ? tr('renews') : tr('access until'), v: dateText(current.end_date) },
                { k: tr('credits'), v: current.available_credits == null ? '—' : String(current.available_credits) },
              ].map((row) => (
                <View key={row.k} style={{ flex: 1, backgroundColor: t.bg, borderRadius: 13, paddingVertical: 13, paddingHorizontal: 15, gap: 3 }}>
                  <Txt size={11} color={t.mut2}>{row.k}</Txt>
                  <Txt size={13.5} weight="700">{row.v}</Txt>
                </View>
              ))}
            </View>
            {current.auto_renew && current.is_active && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                {cancelConfirm ? (
                  <>
                    <Txt size={12.5} color={t.mut} style={{ flex: 1 }}>{`${tr('turn off auto-renew?')} ${tr('you keep')} ${current.package.name.toLowerCase()} ${tr('until')} ${dateText(current.end_date)}.`}</Txt>
                    <Pressable onPress={() => void cancelRenewal()} disabled={busy} accessibilityRole="button" style={{ borderWidth: 1.5, borderColor: '#FDE2E2', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 15 }}>
                      <Txt size={12.5} weight="600" color={danger}>{busy ? tr('working…') : tr('yes, turn it off')}</Txt>
                    </Pressable>
                    <Pressable onPress={() => setCancelConfirm(false)} disabled={busy} accessibilityRole="button" style={{ borderWidth: 1.5, borderColor: t.chip, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 15 }}>
                      <Txt size={12.5} weight="600">{tr('keep it')}</Txt>
                    </Pressable>
                  </>
                ) : (
                  <Pressable onPress={() => setCancelConfirm(true)} accessibilityRole="button" style={{ marginLeft: 'auto', borderWidth: 1.5, borderColor: '#FDE2E2', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 15 }}>
                    <Txt size={12.5} weight="600" color={danger}>{tr('cancel auto-renew')}</Txt>
                  </Pressable>
                )}
              </View>
            )}
            {cancelNote && <Txt size={12} color={t.mut}>{cancelNote}</Txt>}
            {!current.auto_renew && (
              <Txt size={12} color={t.mut}>{tr('auto-renew is off. your plan stays on until the date above, then you drop to free — nothing is deleted.')}</Txt>
            )}
          </View>
        )}

        {/* payments */}
        {signedIn && (
          <View style={{ backgroundColor: t.card, borderRadius: 20, paddingVertical: 22, paddingHorizontal: 24, gap: 12, shadowColor: '#141519', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 }}>
            <Txt size={15} weight="700">{tr('payments')}</Txt>
            {payments === null && !paymentsError && <ActivityIndicator color={t.mut} style={{ alignSelf: 'flex-start' }} />}
            {paymentsError && (
              <View style={{ gap: 8, alignItems: 'flex-start' }}>
                <Txt size={13} weight="600" color={danger}>{paymentsError}</Txt>
                <Pressable onPress={() => void loadAccount()} accessibilityRole="button" style={{ backgroundColor: t.chip, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 }}>
                  <Txt size={12.5} weight="700">{tr('try again')}</Txt>
                </Pressable>
              </View>
            )}
            {payments !== null && !paymentsError && payments.length === 0 && (
              <Txt size={13} color={t.mut}>{tr('no payments yet.')}</Txt>
            )}
            {payments?.map((p) => (
              <View key={String(p.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: t.bg, paddingTop: 10 }}>
                <Txt size={12} mono color={t.mut2}>{`#${p.id}`}</Txt>
                <Txt size={13.5} weight="700">{money(Number(p.amount), p.currency)}</Txt>
                {p.billing_cycle && <Txt size={12.5} color={t.mut}>{humanize(p.billing_cycle)}</Txt>}
                <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ backgroundColor: p.status.toLowerCase() === 'completed' || p.status.toLowerCase() === 'succeeded' || p.status.toLowerCase() === 'paid' ? t.greenbg : t.chip, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10 }}>
                    <Txt size={11.5} weight="700" color={p.status.toLowerCase() === 'completed' || p.status.toLowerCase() === 'succeeded' || p.status.toLowerCase() === 'paid' ? t.green : t.mut}>{humanize(p.status)}</Txt>
                  </View>
                  <Txt size={12} color={t.mut2}>{dateText(p.created_at)}</Txt>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
