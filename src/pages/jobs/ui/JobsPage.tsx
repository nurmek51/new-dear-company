import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { getJobPageSuggestedSearches, type JobSearchParams } from '@/entities/job';
import { useAuth } from '@/entities/user';
import {
  activeDatePreset,
  activeFilterCount,
  datePresetThreshold,
  useActiveJobParams,
  useJobFeed,
  useJobStats,
  useSavedJobs,
  type DatePreset,
} from '@/features/job-feed';
import { useSeekerPrefs } from '@/features/onboarding';
import { useBreakpoint } from '@/shared/lib/responsive';
import { useT } from '@/shared/lib/useT';
import { accent, accentInk, useTheme } from '@/shared/theme';
import { Btn, Chip, Txt } from '@/shared/ui';
import { JobFilterPanel } from '@/widgets/job-filters';
import { JobCard } from './JobCard';
import { Pager } from './Pager';
import { SearchBar } from './SearchBar';
import { StatPills } from './StatPills';

/** The design's rotating letter lines (629–636) — static copy, cycles on tap. */
const heroLines = [
  'ghosting is not a personality.',
  'put the salary in the posting.',
  '“we’re a family” is a red flag.',
  'pay what the role is worth.',
  'reply. even if it’s a no.',
];

function isEmptyParams(p: JobSearchParams): boolean {
  return activeFilterCount(p) === 0 && !p.q;
}

export function JobsPage() {
  const t = useTheme();
  const tr = useT();
  const bp = useBreakpoint();
  const signedIn = useAuth((s) => s.status === 'signedIn');

  const params = useActiveJobParams((s) => s.params);
  const setParams = useActiveJobParams((s) => s.setParams);
  const patchParams = useActiveJobParams((s) => s.patchParams);
  const reset = useActiveJobParams((s) => s.reset);
  const seeded = useActiveJobParams((s) => s.seededFromPrefs);
  const markSeeded = useActiveJobParams((s) => s.markSeeded);

  const prefs = useSeekerPrefs();
  const saved = useSavedJobs();

  const [heroIdx, setHeroIdx] = useState(0);
  const [q, setQ] = useState(params.q ?? '');
  const [suggested, setSuggested] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // one-shot: seed the feed from onboarding preferences
  useEffect(() => {
    if (seeded || !prefs.hydrated) return;
    if (isEmptyParams(params) && (prefs.grades.length || prefs.workFormat.length || prefs.specializations.length)) {
      setParams({
        grade: prefs.grades.length ? prefs.grades : undefined,
        work_format: prefs.workFormat.length ? prefs.workFormat : undefined,
        specializations: prefs.specializations.length ? prefs.specializations : undefined,
        page: 1,
      });
    }
    markSeeded();
  }, [seeded, prefs.hydrated, prefs.grades, prefs.workFormat, prefs.specializations, params, setParams, markSeeded]);

  useEffect(() => setQ(params.q ?? ''), [params.q]);

  useEffect(() => {
    let alive = true;
    getJobPageSuggestedSearches().then((s) => alive && setSuggested(s));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (signedIn) void saved.load();
    else saved.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  const feed = useJobFeed(params);
  const stats = useJobStats(params);
  const activePreset = activeDatePreset(params);
  const filterCount = activeFilterCount(params);

  const submitSearch = (text = q) => patchParams({ q: text.trim() || undefined });
  const pickPreset = (key: DatePreset) => patchParams({ date_posted: datePresetThreshold(key) });
  const onSave = (jobId: string) => {
    if (!signedIn) {
      router.push('/sign-in' as never);
      return;
    }
    void saved.toggle(jobId);
  };
  const openJob = (id: string) => router.push(`/job/${id}` as never);
  const apply = (id: string) => router.push(`/apply?job=${id}` as never);

  const sidebar = <JobFilterPanel value={params} onChange={setParams} />;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 44 }}>
      {/* hero + stats + search (design 631–659) */}
      <View style={{ paddingTop: 36, paddingHorizontal: bp.gutter, paddingBottom: 10, gap: 16 }}>
        <View style={{ gap: 6, alignItems: 'flex-start' }}>
          <Txt size={bp.isMobile ? 29 : 46} weight="700" lh={1.08} ls={-0.04}>
            {tr('dear company,')}
          </Txt>
          <Pressable onPress={() => setHeroIdx((i) => (i + 1) % heroLines.length)} accessibilityRole="button" accessibilityLabel={tr('next line')}>
            <View style={{ backgroundColor: accent, borderRadius: 10, paddingVertical: 2, paddingHorizontal: 16, transform: [{ rotate: '-1.2deg' }] }}>
              <Txt size={bp.isMobile ? 24 : 34} weight="700" ls={-0.03} color={accentInk}>
                {tr(heroLines[heroIdx])}
              </Txt>
            </View>
          </Pressable>
          <Txt mono size={13} color={t.mut} style={{ marginTop: 6 }}>
            {tr('— yours, honestly  ·  tap the letter for the next one')}
          </Txt>
        </View>

        <StatPills stats={stats.stats} loading={stats.loading} active={activePreset} onPick={pickPreset} />

        <SearchBar
          value={q}
          onChangeText={setQ}
          onSubmit={() => submitSearch()}
          onClear={() => {
            setQ('');
            submitSearch('');
          }}
        />

        {suggested.length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, maxWidth: 720 }}>
            <Txt size={12} color={t.mut2}>
              {tr('try')}
            </Txt>
            {suggested.map((s) => (
              <Chip
                key={s}
                label={s}
                size={12.5}
                px={12}
                py={6}
                bg={params.q === s ? accent : t.chip}
                color={params.q === s ? accentInk : t.ink2}
                weight="600"
                onPress={() => {
                  setQ(s);
                  submitSearch(s);
                }}
              />
            ))}
          </View>
        )}
      </View>

      {/* filters + feed (design 660–841) */}
      <View
        style={{
          flexDirection: bp.isMobile ? 'column' : 'row',
          gap: 24,
          paddingTop: 18,
          paddingHorizontal: bp.gutter,
          alignItems: 'flex-start',
        }}
      >
        {bp.isMobile ? (
          <View style={{ width: '100%', gap: 10 }}>
            <Chip
              label={filtersOpen ? tr('hide filters') : `${tr('filters')}${filterCount ? ` · ${filterCount}` : ''}`}
              bg={filterCount ? accent : t.chip}
              color={filterCount ? accentInk : t.ink2}
              weight="600"
              onPress={() => setFiltersOpen((o) => !o)}
              style={{ alignSelf: 'flex-start' }}
            />
            {filtersOpen && sidebar}
          </View>
        ) : (
          <View style={{ width: 280, gap: 10 }}>{sidebar}</View>
        )}

        <View style={{ flex: 1, width: '100%', minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 2, paddingHorizontal: 4, paddingBottom: 12 }}>
            <Txt size={14} weight="600" color={t.ink2} style={{ marginRight: 2 }}>
              {signedIn ? tr('picked for you') : tr('newest first')}
            </Txt>
            {params.q ? (
              <Chip
                label={`“${params.q}” ✕`}
                size={12.5}
                px={13}
                py={6}
                bg={accent}
                color={accentInk}
                weight="600"
                onPress={() => {
                  setQ('');
                  submitSearch('');
                }}
              />
            ) : null}
            <Txt size={13} color={t.mut2} style={{ marginLeft: 'auto' }}>
              {feed.settled && !feed.error ? `${feed.page.count.toLocaleString('en-US')} ${tr('matches')}` : ''}
            </Txt>
          </View>

          {feed.loading && !feed.settled && (
            <View style={{ paddingVertical: 60, alignItems: 'center', gap: 10 }}>
              <ActivityIndicator color={t.mut} />
              <Txt size={13} color={t.mut2}>
                {tr('loading the feed…')}
              </Txt>
            </View>
          )}

          {feed.error && (
            <View style={{ alignItems: 'center', gap: 12, paddingVertical: 44, paddingHorizontal: 24, backgroundColor: t.card, borderRadius: 20 }}>
              <Txt size={17} weight="700" ls={-0.02} align="center">
                {tr('the feed did not load')}
              </Txt>
              <Txt size={13.5} color={t.mut} align="center" lh={1.6} style={{ maxWidth: 380 }}>
                {feed.error}
              </Txt>
              <Btn label={tr('try again')} variant="accent" radius={12} px={24} py={11} size={13.5} onPress={feed.retry} style={{ marginTop: 4 }} />
            </View>
          )}

          {!feed.error && feed.settled && (
            <View style={{ opacity: feed.loading ? 0.6 : 1 }}>
              {feed.page.results.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  saved={saved.savedJobIds[job.id] === true}
                  savePending={!!saved.pending[job.id]}
                  onOpen={() => openJob(job.id)}
                  onApply={() => apply(job.id)}
                  onSave={() => onSave(job.id)}
                />
              ))}

              {feed.page.results.length === 0 && (
                <View style={{ alignItems: 'center', gap: 12, paddingVertical: 44, paddingHorizontal: 24, backgroundColor: t.card, borderRadius: 20 }}>
                  <Txt size={17} weight="700" ls={-0.02} align="center">
                    {tr('nothing matches this exact combo — yet')}
                  </Txt>
                  <Txt size={13.5} color={t.mut} align="center" lh={1.6} style={{ maxWidth: 380 }}>
                    {tr('that’s a picky filter, and picky is good. loosen one thing and the feed will refill.')}
                  </Txt>
                  {(filterCount > 0 || params.q) && (
                    <Btn
                      label={tr('clear all filters')}
                      variant="accent"
                      radius={12}
                      px={24}
                      py={11}
                      size={13.5}
                      onPress={() => {
                        setQ('');
                        reset();
                      }}
                      style={{ marginTop: 4 }}
                    />
                  )}
                </View>
              )}

              {saved.error && (
                <Txt size={12.5} color={t.mut} style={{ paddingHorizontal: 4, paddingTop: 6 }}>
                  {tr(saved.error)}
                </Txt>
              )}

              <Pager
                page={feed.currentPage}
                totalPages={feed.totalPages}
                hasPrev={feed.prevPage != null}
                hasNext={feed.nextPage != null}
                onPrev={() => patchParams({ page: feed.prevPage ?? 1 })}
                onNext={() => patchParams({ page: feed.nextPage ?? feed.currentPage + 1 })}
              />
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
