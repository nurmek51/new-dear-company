import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, View } from 'react-native';
import {
  FUNNEL_GROUPS,
  activeCount,
  atsReportApi,
  groupRow,
  sumGroups,
  type GroupCounts,
  type PipelineRow,
  type PostedJob,
  type StageGroup,
} from '@/entities/ats-report';
import { ApiError, pageFromUrl, type Paginated } from '@/shared/api';
import { useBreakpoint } from '@/shared/lib/responsive';
import { useT } from '@/shared/lib/useT';
import { accent, link, useTheme, type Palette } from '@/shared/theme';
import { Txt } from '@/shared/ui';

/**
 * Recruiter overview (Recruiter ATS prototype 226–325). KEPT: date header,
 * two-column layout, "open jobs" card with stacked stage bars + legend, the
 * dark stat tile. ADAPTED to real data: jobs come from b2b-posted-jobs
 * (§4.2), bars/counters from job-pipeline (§4.2). HIDDEN: "needs your
 * attention", "upcoming interviews", "recent activity", posting lifetime /
 * repost / plan upsell, drafts — no endpoint provides any of them.
 */
/** Safety cap: totals stay honest by reporting when the walk was cut short. */
const MAX_PIPELINE_PAGES = 25;

function barColor(t: Palette, g: StageGroup): string {
  return { applied: t.chip, screening: '#DBE7FC', interview: accent, offer: '#FCE8DC', hired: '#141519', closed: t.l12 }[g];
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toLowerCase();
}

/** Fetch every pipeline page so counters sum across all jobs, capped for safety. */
async function loadAllPipeline(): Promise<{ rows: PipelineRow[]; truncated: boolean }> {
  const rows: PipelineRow[] = [];
  let page = 1;
  for (let i = 0; i < MAX_PIPELINE_PAGES; i++) {
    const res = await atsReportApi.jobPipeline(page);
    rows.push(...res.results);
    const next = pageFromUrl(res.next);
    if (!next) return { rows, truncated: false };
    page = next;
  }
  return { rows, truncated: true };
}

function Panel({ children, title }: { children: ReactNode; title?: string }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.card, borderWidth: 1, borderColor: t.l10, borderRadius: 14, overflow: 'hidden' }}>
      {title ? (
        <View style={{ paddingVertical: 14, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: t.l08 }}>
          <Txt size={13} weight="700">{title}</Txt>
        </View>
      ) : null}
      {children}
    </View>
  );
}

function Avatars({ urls }: { urls: (string | null)[] }) {
  const t = useTheme();
  const shown = urls.filter((u): u is string => typeof u === 'string' && u.length > 0).slice(0, 5);
  if (!shown.length) return null;
  return (
    <View style={{ flexDirection: 'row', marginTop: 6 }}>
      {shown.map((u, i) => (
        <Image key={`${u}-${i}`} source={{ uri: u }} accessibilityIgnoresInvertColors style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: t.card, backgroundColor: t.chip, marginLeft: i ? -7 : 0 }} />
      ))}
    </View>
  );
}

export function RecruiterOverviewPage() {
  const t = useTheme();
  const tr = useT();
  const bp = useBreakpoint();
  const router = useRouter();

  const [jobs, setJobs] = useState<Paginated<PostedJob> | null>(null);
  const [page, setPage] = useState(1);
  const [pipeline, setPipeline] = useState<PipelineRow[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const [j, rows] = await Promise.all([atsReportApi.listPostedJobs(p), loadAllPipeline()]);
      setJobs(j);
      setPipeline(rows.rows);
      setTruncated(rows.truncated);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.isNetworkError
            ? tr('could not reach the server. check your connection and retry.')
            : e.message
          : tr('could not load your overview. check your connection and retry.'),
      );
    } finally {
      setLoading(false);
    }
  }, [tr]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await load(page);
    })();
    return () => { cancelled = true; };
  }, [load, page]);

  const rows = pipeline ?? [];
  const totals: GroupCounts = sumGroups(rows);
  const byTitle = new Map(rows.map((r) => [r.jobTitle, groupRow(r)] as const));
  const gutter = bp.isMobile ? 12 : 26;
  const openCount = jobs?.count ?? 0;

  const legend = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 11, paddingHorizontal: 18, backgroundColor: t.hov, flexWrap: 'wrap' }}>
      {FUNNEL_GROUPS.map((g) => (
        <View key={g} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: barColor(t, g) }} />
          <Txt size={11} color={t.mut}>{tr(g)}</Txt>
        </View>
      ))}
    </View>
  );

  const jobRows = (jobs?.results ?? []).map((j) => {
    const g = byTitle.get(j.title);
    const bars = g ? FUNNEL_GROUPS.map((k) => ({ k, n: g[k] })).filter((b) => b.n > 0) : [];
    const active = g ? activeCount(g) : null;
    return (
      <Pressable
        key={j.id}
        onPress={() => router.push(`/recruiter/job/${j.id}` as never)}
        accessibilityRole="button"
        accessibilityLabel={j.title}
        style={(s) => ({ flexDirection: bp.isMobile ? 'column' : 'row', alignItems: bp.isMobile ? 'stretch' : 'center', gap: 14, paddingVertical: 13, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: t.l06, backgroundColor: (s as { hovered?: boolean }).hovered ? t.hov : 'transparent' })}
      >
        <View style={{ flex: 1.4, minWidth: 0 }}>
          <Txt size={13.5} weight="600">{j.title}</Txt>
          <Txt size={11.5} color={t.mut} style={{ marginTop: 2 }}>{j.text}</Txt>
          <Avatars urls={j.images ?? []} />
        </View>
        <View style={{ flex: 2, flexDirection: 'row', gap: 2, alignItems: 'center' }}>
          {bars.length ? bars.map((b) => <View key={b.k} style={{ flex: b.n, height: 20, backgroundColor: barColor(t, b.k), borderRadius: 3 }} />) : <Txt size={11.5} color={t.mut2}>{tr('no applications yet')}</Txt>}
        </View>
        <View style={{ flex: 0.8, alignItems: bp.isMobile ? 'flex-start' : 'flex-end' }}>
          {active != null && <Txt size={12.5} color={t.mut}>{active} {tr('active')}</Txt>}
        </View>
      </Pressable>
    );
  });

  const prev = pageFromUrl(jobs?.previous ?? null);
  const next = pageFromUrl(jobs?.next ?? null);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ paddingBottom: 26 }}>
      <View style={{ paddingTop: 26, paddingHorizontal: gutter }}>
        <Txt size={bp.isMobile ? 22 : 24} weight="700" ls={-0.03}>{todayLabel()}</Txt>
        <Txt size={13} color={t.mut} style={{ marginTop: 4 }}>
          {loading && !jobs ? tr('loading…') : `${openCount} ${tr('open jobs')} · ${activeCount(totals)} ${tr('active candidates')}`}
        </Txt>
      </View>

      {error && (
        <View style={{ marginHorizontal: gutter, marginTop: 18, backgroundColor: '#FDE2E2', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }} accessibilityLiveRegion="polite">
          <Txt size={12.5} weight="600" color="#b91c1c" style={{ flex: 1 }}>{error}</Txt>
          <Pressable onPress={() => load(page)} accessibilityRole="button" style={{ backgroundColor: '#141519', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 13 }}>
            <Txt size={12} weight="700" color={accent}>{tr('retry')}</Txt>
          </Pressable>
        </View>
      )}

      {loading && !jobs ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator color={t.ink} />
        </View>
      ) : (
        <View style={{ flexDirection: bp.isMobile ? 'column' : 'row', gap: 14, paddingTop: 18, paddingHorizontal: gutter }}>
          <View style={{ flex: 1.5, gap: 14, minWidth: 0 }}>
            <Panel title={tr('open jobs')}>
              {jobRows.length ? jobRows : !jobs ? (
                <View style={{ padding: 18 }}>
                  <Txt size={13} color={t.mut} lh={1.5}>{tr('your jobs could not be loaded. use retry above.')}</Txt>
                </View>
              ) : (
                <View style={{ padding: 18, gap: 10 }}>
                  <Txt size={13} color={t.mut} lh={1.5}>
                    {tr('no jobs posted yet. publish your first job to start receiving applications.')}
                  </Txt>
                  <Pressable onPress={() => router.push('/recruiter/new-job' as never)} accessibilityRole="button" style={{ alignSelf: 'flex-start', backgroundColor: accent, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14 }}>
                    <Txt size={12.5} weight="600" color="#101114">{tr('post your first job')}</Txt>
                  </Pressable>
                </View>
              )}
              {legend}
              {(prev || next) && (
                <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 10, paddingHorizontal: 18, borderTopWidth: 1, borderTopColor: t.l06, alignItems: 'center' }}>
                  <Pressable onPress={prev ? () => setPage(prev) : undefined} accessibilityRole="button" accessibilityState={{ disabled: !prev }}>
                    <Txt size={12} weight="600" color={prev ? link : t.mut2}>{tr('← previous')}</Txt>
                  </Pressable>
                  <Txt size={11.5} color={t.mut2}>{tr('page')} {page}</Txt>
                  <Pressable onPress={next ? () => setPage(next) : undefined} accessibilityRole="button" accessibilityState={{ disabled: !next }}>
                    <Txt size={12} weight="600" color={next ? link : t.mut2}>{tr('next →')}</Txt>
                  </Pressable>
                </View>
              )}
            </Panel>
          </View>

          <View style={{ flex: 1, gap: 14, minWidth: 0 }}>
            <View style={{ backgroundColor: '#141519', borderRadius: 14, padding: 18 }}>
              <Txt size={12} weight="700" color="#a1a1aa" style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>{tr('pipeline right now')}</Txt>
              <View style={{ flexDirection: 'row', gap: 22, marginTop: 12, flexWrap: 'wrap' }}>
                {([['interview', 'in interview'], ['offer', 'offers out'], ['hired', 'hired']] as [StageGroup, string][]).map(([k, label]) => (
                  <View key={k}>
                    <Txt size={26} weight="700" color={accent}>{totals[k]}</Txt>
                    <Txt size={11.5} color="#a1a1aa">{tr(label)}</Txt>
                  </View>
                ))}
              </View>
            </View>
            <Panel title={tr('candidates by stage')}>
              {(['applied', 'screening', 'interview', 'offer', 'hired', 'closed'] as StageGroup[]).map((g, i, arr) => (
                <View key={g} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 18, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: t.l06 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: barColor(t, g) }} />
                  <Txt size={13} weight="600" style={{ flex: 1 }}>{tr(g === 'closed' ? 'rejected / withdrawn' : g)}</Txt>
                  <Txt size={13} weight="700" mono>{totals[g]}</Txt>
                </View>
              ))}
              {truncated && (
                <View style={{ paddingHorizontal: 18, paddingVertical: 11, borderTopWidth: 1, borderTopColor: t.l06 }}>
                  <Txt size={11.5} color={t.mut} lh={1.5}>
                    {tr('you have more jobs than we can total in one go — these counts cover the most recent ones. open a job for its exact pipeline.')}
                  </Txt>
                </View>
              )}
            </Panel>
            <Pressable onPress={() => router.push('/recruiter/reports' as never)} accessibilityRole="link" style={{ paddingHorizontal: 4 }}>
              <Txt size={12.5} weight="600" color={link}>{tr('open the full report →')}</Txt>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
