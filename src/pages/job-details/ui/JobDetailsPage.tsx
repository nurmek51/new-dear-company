import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, Pressable, ScrollView, Share, View } from 'react-native';
import { jobsApi, type Job } from '@/entities/job';
import { useAuth } from '@/entities/user';
import { htmlToText, locationLabel, logoTone, postedAgo, salaryLabel, useSavedJobs } from '@/features/job-feed';
import { ApiError, errorMessageFrom, humanize } from '@/shared/api';
import { useBreakpoint } from '@/shared/lib/responsive';
import { useT } from '@/shared/lib/useT';
import { accent, accentInk, link, useTheme } from '@/shared/theme';
import { Btn, Card, Chip, LogoBadge, Txt } from '@/shared/ui';
import { MatchPanel } from './MatchPanel';
import { SimilarJobs } from './SimilarJobs';

type LoadState = { kind: 'loading' } | { kind: 'missing' } | { kind: 'error'; message: string } | { kind: 'ready'; job: Job };

/** Job detail (design 1323–1387) on spec §2.1 `GET /jobs/{id}/`. */
export function JobDetailsPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = typeof id === 'string' ? id : '';
  const t = useTheme();
  const tr = useT();
  const bp = useBreakpoint();
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  const signedIn = status === 'signedIn';
  const isSeeker = signedIn && user?.user_type === 'b2c';
  const saved = useSavedJobs();

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [tick, setTick] = useState(0);
  const [score, setScore] = useState<number | null>(null);
  const [shared, setShared] = useState(false);
  const sharedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!jobId) {
      setState({ kind: 'missing' });
      return;
    }
    let alive = true;
    setState({ kind: 'loading' });
    setScore(null);
    jobsApi
      .getJob(jobId)
      .then((job) => alive && setState(job ? { kind: 'ready', job } : { kind: 'missing' }))
      .catch((e: unknown) => {
        if (!alive) return;
        const message = e instanceof ApiError ? errorMessageFrom(e.payload, e.message) : 'could not load this job. check your connection and retry.';
        setState({ kind: 'error', message });
      });
    return () => {
      alive = false;
    };
  }, [jobId, tick]);

  useEffect(() => {
    if (signedIn) void saved.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  useEffect(
    () => () => {
      if (sharedTimer.current) clearTimeout(sharedTimer.current);
    },
    [],
  );

  const back = () => (router.canGoBack() ? router.back() : router.replace('/jobs' as never));

  const pad = { paddingTop: 30, paddingHorizontal: bp.gutter, paddingBottom: 44 };

  if (state.kind === 'loading') {
    return (
      <View style={{ ...pad, alignItems: 'center', gap: 10 }}>
        <ActivityIndicator color={t.mut} />
        <Txt size={13} color={t.mut2}>
          {tr('opening the posting…')}
        </Txt>
      </View>
    );
  }
  if (state.kind === 'missing' || state.kind === 'error') {
    return (
      <View style={{ ...pad, maxWidth: 880, width: '100%', alignSelf: 'center', gap: 14 }}>
        <BackLink onPress={back} label={tr('← back to the feed')} />
        <Card radius={20} padding={26} gap={12} style={{ alignItems: 'center' }}>
          <Txt size={17} weight="700" ls={-0.02} align="center">
            {state.kind === 'missing' ? tr('this posting is gone') : tr('this posting did not load')}
          </Txt>
          <Txt size={13.5} color={t.mut} align="center" lh={1.6} style={{ maxWidth: 380 }}>
            {state.kind === 'missing' ? tr('it was closed or never existed. the feed has plenty more.') : state.message}
          </Txt>
          {state.kind === 'error' ? (
            <Btn label={tr('try again')} variant="accent" size={13.5} px={24} py={11} onPress={() => setTick((n) => n + 1)} />
          ) : (
            <Btn label={tr('back to the feed')} variant="accent" size={13.5} px={24} py={11} onPress={back} />
          )}
        </Card>
      </View>
    );
  }

  const job = state.job;
  const org = job.organization;
  const orgName = org?.name ?? '';
  const tone = logoTone(orgName || job.title);
  const letter = (orgName || job.title || '?').trim()[0]?.toUpperCase() ?? '?';
  const isSaved = saved.savedJobIds[job.id] === true;
  const external = job.source && job.source !== 'internal';

  const meta = [orgName, locationLabel(job.job_locations), job.work_format ? humanize(String(job.work_format)) : '', postedAgo(job.date_posted)]
    .filter((x) => x.length > 0)
    .join(' · ');

  const chips: string[] = [];
  for (const l of job.job_locations) {
    const s = [l.locality, l.country].filter((x): x is string => !!x).join(', ');
    if (s) chips.push(s);
  }
  if (job.work_format) chips.push(humanize(String(job.work_format)));
  if (job.employment_type) chips.push(humanize(String(job.employment_type)));
  if (job.grade) chips.push(job.grade === 'clevel' ? 'c-level' : humanize(String(job.grade)));
  if (job.english_level) chips.push(`${tr('english')} ${job.english_level}`);
  if (job.experience_required != null) chips.push(`${job.experience_required}+ ${tr('years')}`);
  if (job.vacancy_languages) chips.push(String(job.vacancy_languages).toLowerCase());

  const description = job.description_text?.trim() || (job.description_html ? htmlToText(job.description_html) : '');
  const responsibilities = job.responsibilities?.trim() ?? '';

  const onSave = () => {
    if (!signedIn) {
      router.push('/sign-in' as never);
      return;
    }
    void saved.toggle(job.id);
  };
  const onApply = () => router.push(`/apply?job=${job.id}` as never);
  const onVisit = () => {
    if (job.job_url) void Linking.openURL(job.job_url);
  };
  const onShare = async () => {
    const text = `${job.title} — ${orgName}${job.job_url ? ` · ${job.job_url}` : ''}`;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        const href = typeof window !== 'undefined' ? window.location.href : '';
        await navigator.clipboard.writeText(href ? `${text} · ${href}` : text);
      } else {
        await Share.share({ message: text });
      }
      setShared(true);
      if (sharedTimer.current) clearTimeout(sharedTimer.current);
      sharedTimer.current = setTimeout(() => setShared(false), 2000);
    } catch {
      // user dismissed or clipboard unavailable — nothing to report
    }
  };

  const listBlock = (title: string, items: string[]) =>
    items.length > 0 && (
      <View style={{ gap: 8 }}>
        <Txt size={13} weight="700">
          {title}
        </Txt>
        {items.map((it, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
            <Txt size={14} color={t.ink2} lh={1.7}>
              •
            </Txt>
            <Txt size={14} color={t.ink2} lh={1.7} style={{ flex: 1 }}>
              {it}
            </Txt>
          </View>
        ))}
      </View>
    );

  const actions = (
    <View style={{ gap: 6, alignItems: bp.isMobile ? 'flex-start' : 'flex-end' }}>
      <Txt size={24} weight="700" style={{ fontVariant: ['tabular-nums'] }}>
        {salaryLabel(job.salary)}
      </Txt>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={onApply}
          accessibilityRole="button"
          style={(s) => ({ paddingVertical: 12, paddingHorizontal: 28, borderRadius: 13, backgroundColor: (s as { hovered?: boolean }).hovered ? link : '#141519' })}
        >
          <Txt size={14} weight="700" color="#F6F4EE">
            {tr('apply')}
          </Txt>
        </Pressable>
        <Pressable
          onPress={onSave}
          disabled={!!saved.pending[job.id]}
          accessibilityRole="button"
          accessibilityLabel={isSaved ? tr('remove from saved') : tr('save job')}
          accessibilityState={{ selected: isSaved }}
          style={(s) => ({
            width: 44,
            height: 44,
            borderRadius: 13,
            backgroundColor: isSaved || (s as { hovered?: boolean }).hovered ? accent : t.chip,
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Txt size={16} color={accentInk}>
            {isSaved ? '🖤' : '♡'}
          </Txt>
        </Pressable>
      </View>
      <Txt size={11.5} color={t.mut2}>
        {external ? `${tr('via')} ${humanize(job.source)}` : tr('posted on dear company')}
      </Txt>
      <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap', justifyContent: bp.isMobile ? 'flex-start' : 'flex-end' }}>
        {job.job_url ? <UnderlineLink label={tr('view original posting ↗')} onPress={onVisit} /> : null}
        <UnderlineLink label={shared ? tr('copied ✓') : tr('share')} onPress={onShare} />
      </View>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={{ ...pad, maxWidth: 880, width: '100%', alignSelf: 'center', gap: 14 }}>
      <BackLink onPress={back} label={tr('← back to the feed')} />

      <View style={{ flexDirection: bp.isMobile ? 'column' : 'row', alignItems: 'flex-start', gap: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14, flex: 1, minWidth: 0 }}>
          {org?.logo_display ? (
            <Image source={{ uri: org.logo_display }} style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: t.chip }} accessibilityIgnoresInvertColors />
          ) : (
            <LogoBadge letter={letter} bg={t[tone.bg]} color={t[tone.fg]} size={52} radius={14} fontSize={20} />
          )}
          <View style={{ gap: 8, flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Txt size={bp.isMobile ? 26 : 36} weight="700" ls={-0.03} lh={1.1}>
                {job.title}
              </Txt>
              {score != null && (
                <View style={{ backgroundColor: accent, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999 }}>
                  <Txt size={12} weight="700" color={accentInk}>
                    {Math.round(score)}% {tr('match')}
                  </Txt>
                </View>
              )}
              {org?.is_verified && (
                <View style={{ backgroundColor: t.greenbg, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999 }}>
                  <Txt size={12} weight="700" color={t.green}>
                    {tr('verified company')}
                  </Txt>
                </View>
              )}
            </View>
            <Txt size={14.5} color={t.mut}>
              {meta}
            </Txt>
          </View>
        </View>
        {actions}
      </View>

      {chips.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {chips.map((c, i) => (
            <Chip key={`${c}-${i}`} label={c} bg={t.card} color={t.ink2} weight="600" size={12.5} px={12} py={6} />
          ))}
        </View>
      )}

      {isSeeker && <MatchPanel jobId={job.id} onScore={setScore} />}

      <Card radius={20} padding={26} gap={14}>
        <Txt size={15} weight="700">
          {tr('about the role')}
        </Txt>
        {description ? (
          <Txt size={14} color={t.ink2} lh={1.7}>
            {description}
          </Txt>
        ) : (
          <Txt size={14} color={t.mut} lh={1.7}>
            {tr('the posting has no description text.')}
          </Txt>
        )}
        {(responsibilities || job.qualifications.length > 0 || job.highlights.length > 0 || job.skills_required.length > 0) && (
          <View style={{ height: 1, backgroundColor: t.chip }} />
        )}
        {responsibilities ? (
          <View style={{ gap: 8 }}>
            <Txt size={13} weight="700">
              {tr('what they actually need')}
            </Txt>
            <Txt size={14} color={t.ink2} lh={1.7}>
              {responsibilities}
            </Txt>
          </View>
        ) : null}
        {listBlock(tr('qualifications'), job.qualifications)}
        {listBlock(tr('highlights'), job.highlights)}
        {job.skills_required.length > 0 && (
          <View style={{ gap: 8 }}>
            <Txt size={13} weight="700">
              {tr('skills')}
            </Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {job.skills_required.map((s) => (
                <Chip key={s} label={s.toLowerCase()} weight="600" size={12.5} px={12} py={6} />
              ))}
            </View>
          </View>
        )}
        {job.date_validthrough && (
          <Txt size={12.5} color={t.mut2}>
            {tr('applications close')} {job.date_validthrough.slice(0, 10)}
          </Txt>
        )}
      </Card>

      {org && (org.industry || org.size || org.headquarters || org.description) && (
        <Card radius={16} padding={18} gap={4}>
          <Txt size={11.5} weight="600" color={t.mut2}>
            {tr('about the company')}
          </Txt>
          <Txt size={13.5} weight="600">
            {[orgName, org.industry, org.size ? `${org.size} ${tr('people')}` : '', org.headquarters].filter((x): x is string => !!x).join(' · ')}
          </Txt>
          {org.description ? (
            <Txt size={13.5} color={t.ink2} lh={1.6}>
              {org.description}
            </Txt>
          ) : null}
        </Card>
      )}

      <SimilarJobs jobId={job.id} />
    </ScrollView>
  );
}

function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ alignSelf: 'flex-start' }}>
      {(s) => (
        <Txt size={13.5} weight="600" color={(s as { hovered?: boolean }).hovered ? t.ink : t.mut}>
          {label}
        </Txt>
      )}
    </Pressable>
  );
}

function UnderlineLink({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="link">
      {(s) => (
        <Txt size={12.5} weight="600" color={(s as { hovered?: boolean }).hovered ? t.ink : t.mut} style={{ textDecorationLine: 'underline' }}>
          {label}
        </Txt>
      )}
    </Pressable>
  );
}
