import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { jobsApi, type Job, type JobSearchParams, type SavedJob, type SearchQuery } from '@/entities/job';
import { useActiveJobParams } from '@/features/job-feed';
import { ApiError, errorMessageFrom } from '@/shared/api';
import { useBreakpoint } from '@/shared/lib/responsive';
import { useT } from '@/shared/lib/useT';
import { accent, accentInk, danger, useTheme } from '@/shared/theme';
import { Txt } from '@/shared/ui';
import { NewSavedSearchTile } from './NewSavedSearchTile';
import { SavedJobCard } from './SavedJobCard';
import { SavedSearchCard } from './SavedSearchCard';
import { paramChips, snapshotParams } from './shared';

interface ResolvedSaved {
  savedId: string | number;
  job: Job | null;
  jobId: string;
  savedAt?: string;
}

function messageOf(e: unknown, fallback: string): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return errorMessageFrom(e, fallback);
}

/**
 * A saved row only nests `{id,title,slug,text}`, so the card's company, salary
 * and location come from fetching the job itself.
 */
async function resolveSaved(rows: SavedJob[]): Promise<ResolvedSaved[]> {
  return Promise.all(
    rows.map(async (r) => {
      const jobId = typeof r.job === 'string' ? r.job : (r.job?.id ?? '');
      const job = jobId ? await jobsApi.getJob(jobId).catch(() => null) : null;
      return { savedId: r.id, job, jobId, savedAt: r.created_at };
    }),
  );
}

/** /saved — saved jobs (left) + saved searches (right). Design "Saved" screen, lines 1388–1532. */
export function SavedPage() {
  const t = useTheme();
  const tr = useT();
  const bp = useBreakpoint();
  const router = useRouter();
  const activeParams = useActiveJobParams((s) => s.params);
  const setParams = useActiveJobParams((s) => s.setParams);
  const alive = useRef(true);

  const [jobs, setJobs] = useState<ResolvedSaved[] | null>(null);
  const [jobsCount, setJobsCount] = useState(0);
  const [jobsHasMore, setJobsHasMore] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const [searches, setSearches] = useState<SearchQuery[] | null>(null);
  const [searchesError, setSearchesError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const loadJobs = useCallback(async () => {
    setJobsError(null);
    setJobs(null);
    try {
      const page = await jobsApi.listSavedJobs();
      const rows = await resolveSaved(page.results);
      if (!alive.current) return;
      setJobs(rows);
      setJobsCount(page.count);
      setJobsHasMore(!!page.next);
    } catch (e) {
      if (!alive.current) return;
      setJobsError(messageOf(e, tr('could not load your saved jobs')));
      setJobs([]);
    }
  }, [tr]);

  const loadSearches = useCallback(async () => {
    setSearchesError(null);
    setSearches(null);
    try {
      const rows = await jobsApi.listSearchQueries('preference');
      if (!alive.current) return;
      setSearches(rows);
    } catch (e) {
      if (!alive.current) return;
      setSearchesError(messageOf(e, tr('could not load your saved searches')));
      setSearches([]);
    }
  }, [tr]);

  useEffect(() => {
    void loadJobs();
    void loadSearches();
  }, [loadJobs, loadSearches]);

  const remove = async (row: ResolvedSaved) => {
    const key = String(row.savedId);
    setRemoving(key);
    setActionError(null);
    try {
      await jobsApi.unsaveJob(row.savedId);
      if (!alive.current) return;
      setJobs((xs) => (xs ? xs.filter((x) => String(x.savedId) !== key) : xs));
      setJobsCount((n) => Math.max(0, n - 1));
    } catch (e) {
      if (alive.current) setActionError(messageOf(e, tr('could not remove that job')));
    } finally {
      if (alive.current) setRemoving(null);
    }
  };

  const runSearch = (q: SearchQuery) => {
    const data = (q.preference_data ?? {}) as JobSearchParams;
    setParams({ ...data, page: 1 });
    router.push('/jobs' as never);
  };

  const deleteSearch = async (q: SearchQuery) => {
    const key = String(q.id);
    setDeleting(key);
    setActionError(null);
    try {
      await jobsApi.deleteSearchQuery(q.id);
      if (!alive.current) return;
      setSearches((xs) => (xs ? xs.filter((x) => String(x.id) !== key) : xs));
    } catch (e) {
      if (alive.current) setActionError(messageOf(e, tr('could not delete that search')));
    } finally {
      if (alive.current) setDeleting(null);
    }
  };

  const saveSearch = async (name: string): Promise<boolean> => {
    setSaving(true);
    setSaveError(null);
    try {
      const created = await jobsApi.createSearchQuery({
        search_type: 'preference',
        data: name,
        preference_data: snapshotParams(activeParams),
        source_page: 'saved',
      });
      if (!alive.current) return false;
      setSearches((xs) => [created, ...(xs ?? []).filter((x) => String(x.id) !== String(created.id))]);
      return true;
    } catch (e) {
      if (alive.current) setSaveError(messageOf(e, tr('could not save that search')));
      return false;
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const g = bp.gutter;
  const h1 = bp.isMobile ? 29 : 46;
  const currentChips = paramChips(snapshotParams(activeParams));

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 44 }}>
      <View style={{ paddingTop: 38, paddingHorizontal: g, paddingBottom: 8, gap: 12 }}>
        <Txt size={h1} weight="700" lh={1.05} ls={-0.04} accessibilityRole="header">
          {tr('your')}{' '}
          <View style={{ backgroundColor: accent, borderRadius: 10, paddingHorizontal: 14, transform: [{ rotate: '-1.2deg' }] }}>
            <Txt size={h1} weight="700" lh={1.05} ls={-0.04} color={accentInk}>{tr('shortlist')}</Txt>
          </View>
          {',\n'}
          {tr('safe and sound')}
        </Txt>
        <Txt size={bp.isMobile ? 14 : 15.5} color={t.mut}>
          {tr('saved jobs stay put. saved searches are shortcuts — one tap re-runs the exact filters on the live feed. nothing expires overnight.')}
        </Txt>
      </View>

      {actionError && (
        <View style={{ marginHorizontal: g, marginTop: 12, backgroundColor: '#FDE2E2', borderRadius: 11, paddingVertical: 10, paddingHorizontal: 13 }}>
          <Txt size={12.5} weight="600" color={danger}>{actionError}</Txt>
        </View>
      )}

      <View style={{ flexDirection: bp.isMobile ? 'column' : 'row', gap: 24, paddingTop: 24, paddingHorizontal: g, alignItems: 'flex-start' }}>
        {/* saved jobs */}
        <View style={{ flex: bp.isMobile ? undefined : 1, width: '100%', minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingTop: 2, paddingHorizontal: 4, paddingBottom: 12 }}>
            <Txt size={14} weight="700">{tr('saved jobs')}</Txt>
            {jobs && !jobsError && (
              <Txt size={13} color={t.mut2}>{`· ${jobsCount} ${tr('in your pocket')}`}</Txt>
            )}
          </View>

          {jobs === null && (
            <View style={{ paddingVertical: 40, alignItems: 'center', gap: 10 }}>
              <ActivityIndicator color={t.mut} />
              <Txt size={13} color={t.mut2}>{tr('fetching your shortlist…')}</Txt>
            </View>
          )}

          {jobs !== null && jobsError && (
            <View style={{ backgroundColor: t.card, borderRadius: 20, padding: 24, gap: 10, alignItems: 'flex-start' }}>
              <Txt size={13.5} weight="600" color={danger}>{jobsError}</Txt>
              <Pressable onPress={() => void loadJobs()} accessibilityRole="button" style={{ backgroundColor: t.chip, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 }}>
                <Txt size={12.5} weight="700">{tr('try again')}</Txt>
              </Pressable>
            </View>
          )}

          {jobs !== null && !jobsError && jobs.length === 0 && (
            <View style={{ backgroundColor: t.card, borderRadius: 20, padding: 24, gap: 10, alignItems: 'flex-start' }}>
              <Txt size={15} weight="700">{tr('nothing saved yet')}</Txt>
              <Txt size={13.5} color={t.mut}>{tr('tap "save" on any job in the feed and it lands here.')}</Txt>
              <Pressable onPress={() => router.push('/jobs' as never)} accessibilityRole="link" style={{ backgroundColor: accent, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 }}>
                <Txt size={12.5} weight="700" color={accentInk}>{tr('browse jobs')}</Txt>
              </Pressable>
            </View>
          )}

          {jobs !== null && !jobsError && jobs.map((row) =>
            row.job ? (
              <SavedJobCard
                key={String(row.savedId)}
                job={row.job}
                savedAt={row.savedAt}
                removing={removing === String(row.savedId)}
                onApply={() => router.push({ pathname: '/apply', params: { job: row.jobId } } as never)}
                onRemove={() => void remove(row)}
              />
            ) : (
              <View key={String(row.savedId)} style={{ flexDirection: 'row', alignItems: 'center', gap: 20, paddingVertical: 20, paddingHorizontal: 24, backgroundColor: t.card2, borderRadius: 20, marginBottom: 10 }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Txt size={18} weight="700" ls={-0.02} color={t.ink2}>{tr('this job is no longer available')}</Txt>
                  <Txt size={13.5} color={t.mut}>{tr('the posting was taken down or the id changed.')}</Txt>
                </View>
                <Pressable onPress={() => void remove(row)} disabled={removing === String(row.savedId)} accessibilityRole="button" style={{ backgroundColor: t.card, paddingVertical: 10, paddingHorizontal: 22, borderRadius: 12 }}>
                  <Txt size={13.5} weight="600" color={t.ink2}>{tr('remove')}</Txt>
                </Pressable>
              </View>
            ),
          )}

          {jobs !== null && !jobsError && jobs.length > 0 && (
            <View style={{ alignItems: 'center', paddingTop: 10 }}>
              <Txt size={13} color={t.mut2} align="center">
                {jobsHasMore
                  ? `${tr('showing the first')} ${jobs.length} ${tr('of')} ${jobsCount}`
                  : tr("that's your whole shortlist. quality over quantity — this is plenty.")}
              </Txt>
            </View>
          )}
        </View>

        {/* saved searches */}
        <View style={{ width: bp.isMobile ? '100%' : 380, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingTop: 2, paddingHorizontal: 4, paddingBottom: 2 }}>
            <Txt size={14} weight="700">{tr('saved searches')}</Txt>
            {searches && !searchesError && (
              <Txt size={13} color={t.mut2}>{`· ${searches.length} ${tr(searches.length === 1 ? 'search' : 'searches')}`}</Txt>
            )}
          </View>

          {searches === null && (
            <View style={{ paddingVertical: 30, alignItems: 'center' }}>
              <ActivityIndicator color={t.mut} />
            </View>
          )}
          {searches !== null && searchesError && (
            <View style={{ backgroundColor: t.card, borderRadius: 20, padding: 20, gap: 10, alignItems: 'flex-start' }}>
              <Txt size={13.5} weight="600" color={danger}>{searchesError}</Txt>
              <Pressable onPress={() => void loadSearches()} accessibilityRole="button" style={{ backgroundColor: t.chip, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 }}>
                <Txt size={12.5} weight="700">{tr('try again')}</Txt>
              </Pressable>
            </View>
          )}
          {searches !== null && !searchesError && searches.length === 0 && (
            <View style={{ backgroundColor: t.card, borderRadius: 20, padding: 20, gap: 6 }}>
              <Txt size={15} weight="700">{tr('no saved searches yet')}</Txt>
              <Txt size={12.5} color={t.mut}>{tr('save the filters you keep re-typing and re-run them with one tap.')}</Txt>
            </View>
          )}
          {searches?.map((q) => (
            <SavedSearchCard key={String(q.id)} query={q} deleting={deleting === String(q.id)} onRun={() => runSearch(q)} onDelete={() => void deleteSearch(q)} />
          ))}

          <NewSavedSearchTile currentChips={currentChips} saving={saving} error={saveError} onSave={saveSearch} />

          <View style={{ backgroundColor: '#141519', borderRadius: 20, padding: 20, gap: 10 }}>
            <Txt size={14} weight="700" color="#F6F4EE">{tr('the whole point')}</Txt>
            <Txt size={12.5} color="#a1a1aa" lh={1.55}>
              {tr('a saved search is a shortcut, not an alarm. it re-runs your exact filters on the live feed whenever you open it — no emails, no pings, just less re-typing.')}
            </Txt>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
