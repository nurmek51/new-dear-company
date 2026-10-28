import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { referralsApi, type ReferralProfileInput, type Referrer } from '@/entities/referral';
import { useAuth } from '@/entities/user';
import { ApiError, type Paginated } from '@/shared/api';
import { useBreakpoint } from '@/shared/lib/responsive';
import { useT } from '@/shared/lib/useT';
import { accent, useTheme } from '@/shared/theme';
import { Btn, EmptyState, Field, Overlay, Txt } from '@/shared/ui';
import { ScreenScrollView } from '@/shared/ui/ScreenScrollView';

type Mode = 'need' | 'give';
const blank: ReferralProfileInput = { display_name: '', company: '', roles: '', quote: '', telegram: '', linkedin: '' };

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function contactUrl(url: string | null | undefined, kind: 'telegram' | 'linkedin'): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== 'https:') return null;
    if (kind === 'telegram' && (host === 't.me' || host === 'telegram.me')) return url;
    if (kind === 'linkedin' && (host === 'linkedin.com' || host.endsWith('.linkedin.com'))) return url;
  } catch { /* Reject malformed backend URLs. */ }
  return null;
}

export function ReferralsPage() {
  const t = useTheme();
  const tr = useT();
  const bp = useBreakpoint();
  const router = useRouter();
  const signedIn = useAuth((s) => s.status === 'signedIn');
  const [mode, setMode] = useState<Mode>('need');
  const [search, setSearch] = useState('');
  const [company, setCompany] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Paginated<Referrer> | null>(null);
  const [listError, setListError] = useState('');
  const [listVersion, setListVersion] = useState(0);
  const [form, setForm] = useState<ReferralProfileInput>(blank);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileFetchFailed, setProfileFetchFailed] = useState(false);
  const [profileVersion, setProfileVersion] = useState(0);
  const [hasProfile, setHasProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [contactBusy, setContactBusy] = useState<string | null>(null);
  const [contactError, setContactError] = useState('');
  const [plusRequired, setPlusRequired] = useState(false);
  const padding = bp.gutter;

  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); setCompany(search.trim()); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let live = true;
    setRows(null);
    setListError('');
    referralsApi.list(company, page).then((data) => {
      if (live) setRows(data);
    }).catch((error) => {
      if (live) setListError(message(error, tr('could not load referrers')));
    });
    return () => { live = false; };
  }, [company, page, listVersion, tr]);

  useEffect(() => {
    if (mode !== 'give' || !signedIn) return;
    let live = true;
    setProfileLoading(true);
    setProfileError('');
    setProfileFetchFailed(false);
    referralsApi.myProfile().then((profile) => {
      if (!live) return;
      setHasProfile(!!profile);
      setForm(profile ? {
        display_name: profile.display_name, company: profile.company, roles: profile.roles,
        quote: profile.quote, telegram: profile.telegram, linkedin: profile.linkedin,
      } : blank);
      setProfileLoading(false);
    }).catch((error) => {
      if (live) { setProfileError(message(error, tr('could not load your referral profile'))); setProfileFetchFailed(true); setProfileLoading(false); }
    });
    return () => { live = false; };
  }, [mode, signedIn, profileVersion, tr]);

  const update = (key: keyof ReferralProfileInput, value: string) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    const data = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()])) as unknown as ReferralProfileInput;
    if (!data.display_name || !data.company || (!data.telegram && !data.linkedin)) {
      setProfileError(tr('add your name, company and at least one contact'));
      return;
    }
    setSaving(true);
    setProfileError('');
    try {
      const profile = await referralsApi.saveProfile(data);
      setForm({ display_name: profile.display_name, company: profile.company, roles: profile.roles, quote: profile.quote, telegram: profile.telegram, linkedin: profile.linkedin });
      setHasProfile(true);
      setSaved(true);
      setListVersion((n) => n + 1);
    } catch (error) {
      setProfileError(message(error, tr('could not save your referral profile')));
    } finally { setSaving(false); }
  };

  const remove = async () => {
    setSaving(true);
    setProfileError('');
    try {
      await referralsApi.deleteProfile();
      setForm(blank);
      setHasProfile(false);
      setSaved(false);
      setConfirmDelete(false);
      setListVersion((n) => n + 1);
    } catch (error) {
      setProfileError(message(error, tr('could not remove your referral profile')));
      setConfirmDelete(false);
    } finally { setSaving(false); }
  };

  const openContact = async (referrer: Referrer, kind: 'telegram' | 'linkedin') => {
    setContactError('');
    setPlusRequired(false);
    if (!signedIn) { router.push('/sign-in' as never); return; }
    setContactBusy(referrer.id);
    try {
      const contact = await referralsApi.contact(referrer.id);
      const url = contactUrl(kind === 'telegram' ? contact.telegram_url : contact.linkedin_url, kind);
      if (!url) throw new Error(tr('contact link is unavailable'));
      await Linking.openURL(url);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403 && (error.payload as { code?: string } | null)?.code === 'subscription_required') {
        setPlusRequired(true);
      } else if (error instanceof ApiError && error.status === 404) {
        setContactError(tr('this referrer is no longer available'));
        setListVersion((n) => n + 1);
      } else {
        setContactError(message(error, tr('could not open contact')));
      }
    } finally { setContactBusy(null); }
  };

  return (
    <ScreenScrollView contentContainerStyle={{ paddingHorizontal: padding, paddingTop: bp.isMobile ? 24 : 30, paddingBottom: 64, gap: 22 }}>
      <View style={{ maxWidth: 880, gap: 12 }}>
        <Txt size={bp.isMobile ? 30 : 46} weight="700" lh={1.05}>{tr('know someone inside?')}</Txt>
        <View style={{ alignSelf: 'flex-start', backgroundColor: accent, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4 }}>
          <Txt size={bp.isMobile ? 28 : 43} weight="700" color="#141519">{tr('be someone inside')}</Txt>
        </View>
        <Txt size={15} color={t.mut} lh={1.55} style={{ maxWidth: 620 }}>{tr('referrals move letters to the top of the pile. these humans offered to refer strangers — no favors owed, no awkwardness. just people helping people.')}</Txt>
      </View>
      <View style={{ flexDirection: bp.isMobile ? 'column' : 'row', gap: 12 }}>
        {(['need', 'give'] as const).map((item) => (
          <Pressable key={item} onPress={() => { setMode(item); setContactError(''); setPlusRequired(false); }} accessibilityRole="tab" accessibilityState={{ selected: mode === item }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: mode === item ? '#141519' : t.card, borderRadius: 20, borderWidth: 2, borderColor: mode === item ? '#141519' : t.chip, padding: 18 }}>
            <Txt size={24}>{item === 'need' ? '🙋' : '🤝'}</Txt>
            <View style={{ flex: 1, gap: 3 }}>
              <Txt size={15} weight="700" color={mode === item ? accent : t.ink}>{tr(item === 'need' ? 'I need a referral' : 'I can refer someone')}</Txt>
              <Txt size={12.5} color={mode === item ? '#a1a1aa' : t.mut}>{tr(item === 'need' ? 'find someone inside a company you want' : 'help someone get in')}</Txt>
            </View>
          </Pressable>
        ))}
      </View>
      {mode === 'need' ? (
        <View style={{ gap: 14 }}>
          <Txt size={14} weight="700">{tr("people who'll refer you")}</Txt>
          <View style={{ maxWidth: 420 }}>
            <Field value={search} onChangeText={setSearch} placeholder={tr('find your company…')} bg={t.card} />
          </View>
          {contactError ? <Txt size={13} color="#B42318">{contactError}</Txt> : null}
          {plusRequired ? <View style={{ backgroundColor: '#141519', padding: 18, borderRadius: 16, gap: 10 }}><Txt size={15} weight="700" color="#F6F4EE">{tr('contact details are available with plus')}</Txt><Btn label={tr("see what's in plus →")} variant="accent" onPress={() => router.push('/plus' as never)} style={{ alignSelf: 'flex-start' }} /></View> : null}
          {!rows && !listError ? <ActivityIndicator color={accent} style={{ marginVertical: 28 }} /> : null}
          {listError ? <EmptyState title={tr('could not load referrers')} description={listError}><Btn label={tr('try again')} variant="muted" onPress={() => setListVersion((n) => n + 1)} /></EmptyState> : null}
          {rows?.results.length === 0 ? <EmptyState title={tr('no referrers found')} description={company ? tr('try another company or clear your search') : tr('be the first to help someone get in')}><Btn label={company ? tr('clear search') : tr('I can refer someone')} variant="muted" onPress={() => company ? setSearch('') : setMode('give')} /></EmptyState> : null}
          {rows?.results.map((person) => (
            <View key={person.id} style={{ backgroundColor: t.card, borderRadius: 20, padding: bp.isMobile ? 18 : 22, gap: 12, flexDirection: bp.isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: bp.isMobile ? 'stretch' : 'center' }}>
              <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <Txt size={17} weight="700">{person.display_name}</Txt>
                <View style={{ alignSelf: 'flex-start', backgroundColor: accent, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}><Txt size={12} weight="700" color="#141519">{tr('refers to')} {person.company}</Txt></View>
                {person.roles ? <Txt size={13} color={t.mut}>{person.roles}</Txt> : null}
                {person.quote ? <Txt size={12.5} color={t.ink2}>{person.quote}</Txt> : null}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {person.has_telegram ? <Btn label={contactBusy === person.id ? tr('opening…') : tr('write on telegram')} disabled={contactBusy !== null} onPress={() => void openContact(person, 'telegram')} size={13} px={16} /> : null}
                {person.has_linkedin ? <Btn label={contactBusy === person.id ? tr('opening…') : tr('linkedin')} variant="muted" disabled={contactBusy !== null} onPress={() => void openContact(person, 'linkedin')} size={13} px={16} /> : null}
              </View>
            </View>
          ))}
          {rows && rows.count > 0 ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'center', paddingTop: 8 }}>
            <Btn label="←" variant="muted" disabled={!rows.previous} onPress={() => setPage((n) => Math.max(1, n - 1))} px={14} />
            <Txt size={13} color={t.mut}>{page} · {rows.count} {tr('referrers')}</Txt>
            <Btn label="→" variant="muted" disabled={!rows.next} onPress={() => setPage((n) => n + 1)} px={14} />
          </View> : null}
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          <View style={{ backgroundColor: '#141519', borderRadius: 24, padding: bp.isMobile ? 22 : 30, gap: 12 }}>
            <Txt size={11} weight="700" color={accent}>{tr("we're looking for referrers")}</Txt>
            <Txt size={bp.isMobile ? 25 : 30} weight="700" color="#F6F4EE">{tr('work somewhere nice?')}</Txt>
            <Txt size={13.5} color="#a1a1aa" lh={1.55}>{tr('you choose who to refer and how often. candidates write first.')}</Txt>
          </View>
          {!signedIn ? <EmptyState title={tr('sign in to become a referrer')}><Btn label={tr('sign in')} onPress={() => router.push('/sign-in' as never)} /></EmptyState> : (
            <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', gap: 12, backgroundColor: t.card, borderRadius: 22, padding: bp.isMobile ? 18 : 26 }}>
              <Txt size={20} weight="700">{tr(hasProfile ? 'your referral profile' : 'become a referrer →')}</Txt>
              <Txt size={13} color={t.mut}>{tr('add your company and how candidates can reach you. at least one contact is required.')}</Txt>
              {profileLoading ? <ActivityIndicator color={accent} /> : null}
              {!profileLoading && !profileFetchFailed ? <>
                <Field value={form.display_name} onChangeText={(v) => update('display_name', v)} placeholder={tr('your name *')} />
                <Field value={form.company} onChangeText={(v) => update('company', v)} placeholder={tr('company name *')} />
                <Field value={form.roles} onChangeText={(v) => update('roles', v)} placeholder={tr('roles you can refer for')} />
                <Field value={form.telegram} onChangeText={(v) => update('telegram', v)} placeholder={tr('telegram username (without @)')} />
                <Field value={form.linkedin} onChangeText={(v) => update('linkedin', v)} placeholder={tr('linkedin url')} inputMode="url" />
                <Field value={form.quote} onChangeText={(v) => update('quote', v)} placeholder={tr('a short note for candidates')} multiline />
                {saved ? <Txt size={13} weight="700" color="#17734a">{tr('your card is live')}</Txt> : null}
                <Btn label={saving ? tr('saving…') : tr(hasProfile ? 'save changes' : 'become a referrer →')} variant="accent" disabled={saving} onPress={() => void save()} />
                {hasProfile ? <Btn label={tr('remove my profile')} variant="muted" disabled={saving} onPress={() => setConfirmDelete(true)} /> : null}
              </> : null}
              {profileError ? <Txt size={13} color="#B42318">{profileError}</Txt> : null}
              {!profileLoading && profileFetchFailed ? <Btn label={tr('try again')} variant="muted" onPress={() => setProfileVersion((n) => n + 1)} /> : null}
            </View>
          )}
        </View>
      )}
      <Overlay visible={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <View style={{ gap: 14 }}><Txt size={20} weight="700">{tr('remove your referral profile?')}</Txt><Txt size={13} color={t.mut}>{tr('your card will disappear from search')}</Txt><View style={{ flexDirection: 'row', gap: 8 }}><Btn label={tr('cancel')} variant="muted" onPress={() => setConfirmDelete(false)} /><Btn label={tr('remove my profile')} disabled={saving} onPress={() => void remove()} /></View></View>
      </Overlay>
    </ScreenScrollView>
  );
}
