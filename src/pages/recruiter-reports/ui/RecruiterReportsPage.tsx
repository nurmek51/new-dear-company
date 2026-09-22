import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import {
  FUNNEL_GROUPS,
  activeCount,
  atsReportApi,
  groupRow,
  keyValueSections,
  medianTimeToHire,
  overallEfficiency,
  sumGroups,
  type EfficiencyRow,
  type PipelineRow,
  type StageGroup,
} from '@/entities/ats-report';
import { ApiError, pageFromUrl } from '@/shared/api';
import { useBreakpoint } from '@/shared/lib/responsive';
import { useT } from '@/shared/lib/useT';
import { accent, useTheme, type Palette } from '@/shared/theme';
import { Txt } from '@/shared/ui';

/**
 * Reports (Recruiter ATS prototype 954–1115). KEPT: header, "report for"
 * scope chips (everything / per job), the three KPI tiles, the pipeline
 * funnel, the sources block, the two-column layout. ADAPTED: funnel from
 * job-pipeline (§4.2) collapsed into the design's stage groups; KPIs and a
 * per-job efficiency table from hiring-efficiency (§4.2); sources/departments
 * from the public hiring-data aggregate (§4.3) rendered as generic bars when
 * its shape is readable. HIDDEN: "last 90 days" period picker and csv export
 * (no endpoint), team/recruiter scope + individual recruiter report, average
 * days in stage, weekly trend, "hires this year" list and every prose claim
 * (no data behind them).
 */
/** Safety cap: totals stay honest by reporting when the walk was cut short. */
const MAX_PAGES = 25;

interface PagedAll<T> {
  items: T[];
  /** True when the cap stopped the walk before the last page. */
  truncated: boolean;
}

function barColor(t: Palette, g: StageGroup): string {
  return { applied: t.chip, screening: '#DBE7FC', interview: accent, offer: '#FCE8DC', hired: '#141519', closed: t.l12 }[g];
}

async function loadAll<T>(fetchPage: (p: number) => Promise<{ results: T[]; next: string | null }>): Promise<PagedAll<T>> {
  const items: T[] = [];
  let page = 1;
  for (let i = 0; i < MAX_PAGES; i++) {
    const res = await fetchPage(page);
    items.push(...res.results);
    const next = pageFromUrl(res.next);
    if (!next) return { items, truncated: false };
    page = next;
  }
  return { items, truncated: true };
}

function Card({ children, dark }: { children: ReactNode; dark?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: dark ? '#141519' : t.card, borderWidth: dark ? 0 : 1, borderColor: t.l10, borderRadius: 14, padding: 18 }}>
      {children}
    </View>
  );
}

function Kpi({ label, value, sub, dark }: { label: string; value: string; sub: string; dark?: boolean }) {
  const t = useTheme();
  return (
    <Card dark={dark}>
      <Txt size={11.5} weight="700" color={dark ? '#a1a1aa' : t.mut} style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</Txt>
      <Txt size={30} weight="700" color={dark ? accent : t.ink} style={{ marginTop: 8 }}>{value}</Txt>
      <Txt size={11.5} color={dark ? '#a1a1aa' : t.mut} style={{ marginTop: 2 }}>{sub}</Txt>
    </Card>
  );
}

function BarRow({ name, count, max, color, labelWidth }: { name: string; count: number; max: number; color: string; labelWidth: number }) {
  const t = useTheme();
  const w = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Txt size={12.5} weight="600" style={{ width: labelWidth }} numberOfLines={1}>{name}</Txt>
      <View style={{ flex: 1, height: 26, backgroundColor: t.hov, borderRadius: 7, overflow: 'hidden' }}>
        <View style={{ height: 26, width: `${w}%`, minWidth: 4, backgroundColor: color, borderRadius: 7 }} />
      </View>
      <Txt size={12.5} weight="700" mono style={{ width: 40, textAlign: 'right' }}>{count}</Txt>
    </View>
  );
}

function chipStyle(t: Palette, on: boolean) {
  return { bg: on ? '#141519' : t.card, color: on ? accent : t.ink, border: on ? '#141519' : t.l12 };
}

const fmtDays = (v: number | null) => (v == null ? '—' : `${v}`);
const fmtPct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 10) / 10}%`);

export function RecruiterReportsPage() {
  const t = useTheme();
  const tr = useT();
  const bp = useBreakpoint();
  const gutter = bp.isMobile ? 12 : 26;

  const [pipeline, setPipeline] = useState<PipelineRow[] | null>(null);
  const [efficiency, setEfficiency] = useState<EfficiencyRow[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [hiring, setHiring] = useState<unknown>(null);
  const [scope, setScope] = useState<string | null>(null); // null = everything, else jobTitle
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, e, h] = await Promise.all([
        loadAll(atsReportApi.jobPipeline),
        loadAll(atsReportApi.hiringEfficiency),
        atsReportApi.hiringData().catch(() => null),
      ]);
      setPipeline(p.items);
      setEfficiency(e.items);
      setTruncated(p.truncated || e.truncated);
      setHiring(h);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.isNetworkError
            ? tr('could not reach the server. check your connection and retry.')
            : err.message
          : tr('could not load reports. check your connection and retry.'),
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

  const rows = pipeline ?? [];
  const effRows = efficiency ?? [];
  const scopedRows = scope == null ? rows : rows.filter((r) => r.jobTitle === scope);
  const scopedEff = scope == null ? effRows : effRows.filter((r) => r.job_title === scope);
  const counts = sumGroups(scopedRows);
  const maxFunnel = Math.max(...FUNNEL_GROUPS.map((g) => counts[g]), 1);
  const median = medianTimeToHire(scopedEff);
  const eff = overallEfficiency(scopedEff);
  const sections = keyValueSections(hiring);

  const chip = (label: string, on: boolean, onPress: () => void) => {
    const c = chipStyle(t, on);
    return (
      <Pressable key={label} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ borderRadius: 999, paddingVertical: 6, paddingHorizontal: 13, backgroundColor: c.bg, borderWidth: 1, borderColor: c.border }}>
        <Txt size={12} weight="600" color={c.color}>{label}</Txt>
      </Pressable>
    );
  };

  const effTable = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: '100%' }}>
      <View style={{ minWidth: 600, flex: 1 }}>
        <View style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.l08 }}>
          {[tr('job'), tr('applied'), tr('hired'), tr('efficiency'), tr('time to hire'), tr('time to fill')].map((h, i) => (
            <Txt key={h} size={11} weight="700" color={t.mut} style={{ flex: i === 0 ? 2 : 1, textAlign: i === 0 ? 'left' : 'right', textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</Txt>
          ))}
        </View>
        {scopedEff.map((r) => (
          <View key={r.job_id} style={{ flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.l06, alignItems: 'center' }}>
            <Txt size={12.5} weight="600" style={{ flex: 2 }} numberOfLines={1}>{r.job_title}</Txt>
            <Txt size={12.5} mono style={{ flex: 1, textAlign: 'right' }}>{r.total_applied}</Txt>
            <Txt size={12.5} mono style={{ flex: 1, textAlign: 'right' }}>{r.total_hired}</Txt>
            <Txt size={12.5} mono style={{ flex: 1, textAlign: 'right' }}>{fmtPct(r.hiring_efficiency_in_percentage)}</Txt>
            <Txt size={12.5} mono style={{ flex: 1, textAlign: 'right' }}>{fmtDays(r.time_to_hire_in_days)} {r.time_to_hire_in_days == null ? '' : tr('d')}</Txt>
            <Txt size={12.5} mono style={{ flex: 1, textAlign: 'right' }}>{fmtDays(r.time_to_fill_in_days)} {r.time_to_fill_in_days == null ? '' : tr('d')}</Txt>
          </View>
        ))}
        {!scopedEff.length && <Txt size={12.5} color={t.mut} style={{ paddingVertical: 12 }}>{tr('no hiring data yet — figures appear once a job receives applications.')}</Txt>}
      </View>
    </ScrollView>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ paddingBottom: 26 }}>
      <View style={{ paddingTop: 24, paddingHorizontal: gutter }}>
        <Txt size={bp.isMobile ? 22 : 24} weight="700" ls={-0.03}>{scope == null ? tr('reports') : `${tr('reports')} — ${scope}`}</Txt>
        <Txt size={13} color={t.mut} style={{ marginTop: 4 }}>{scope == null ? tr('across all open jobs · live data') : tr('single job report · live data')}</Txt>
      </View>

      {error && (
        <View style={{ marginHorizontal: gutter, marginTop: 16, backgroundColor: '#FDE2E2', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }} accessibilityLiveRegion="polite">
          <Txt size={12.5} weight="600" color="#b91c1c" style={{ flex: 1 }}>{error}</Txt>
          <Pressable onPress={load} accessibilityRole="button" style={{ backgroundColor: '#141519', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 13 }}>
            <Txt size={12} weight="700" color={accent}>{tr('retry')}</Txt>
          </Pressable>
        </View>
      )}

      {loading && !pipeline ? (
        <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={t.ink} /></View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 16, paddingHorizontal: gutter, flexWrap: 'wrap' }}>
            <Txt size={11.5} weight="600" color={t.mut}>{tr('report for:')}</Txt>
            {chip(tr('everything'), scope == null, () => setScope(null))}
            {rows.length > 0 && (
              <>
                <View style={{ width: 1, height: 18, backgroundColor: t.l12, marginHorizontal: 4 }} />
                <Txt size={11.5} color={t.mut2}>{tr('jobs:')}</Txt>
                {rows.map((r) => chip(r.jobTitle, scope === r.jobTitle, () => setScope(r.jobTitle)))}
              </>
            )}
          </View>

          {rows.length === 0 && !error && pipeline != null && (
            <View style={{ marginHorizontal: gutter, marginTop: 18 }}>
              <Card>
                <Txt size={13} color={t.mut} lh={1.5}>
                  {tr('no pipeline yet. reports fill in as candidates apply to your jobs.')}
                </Txt>
              </Card>
            </View>
          )}

          <View style={{ flexDirection: bp.isMobile ? 'column' : 'row', gap: 14, paddingTop: 18, paddingHorizontal: gutter }}>
            <View style={{ flex: 1 }}>
              <Kpi dark label={tr('median time to hire')} value={median == null ? '—' : `${median} ${tr('days')}`} sub={median == null ? tr('no hires yet') : tr('application → offer accepted, per job')} />
            </View>
            <View style={{ flex: 1 }}>
              <Kpi label={tr('hiring efficiency')} value={eff.pct == null ? '—' : `${eff.hired} ${tr('of')} ${eff.applied}`} sub={eff.pct == null ? tr('no applications yet') : `${eff.pct}% ${tr('of applicants hired')}`} />
            </View>
            <View style={{ flex: 1 }}>
              <Kpi label={tr('active candidates')} value={`${activeCount(counts)}`} sub={`${counts.hired} ${tr('hired')} · ${counts.closed} ${tr('rejected or withdrawn')}`} />
            </View>
          </View>

          <View style={{ flexDirection: bp.isMobile ? 'column' : 'row', gap: 14, paddingTop: 14, paddingHorizontal: gutter }}>
            <View style={{ flex: 1.4, gap: 14, minWidth: 0 }}>
              <Card>
                <Txt size={13} weight="700">{tr('pipeline funnel')}</Txt>
                <Txt size={11.5} color={t.mut} style={{ marginTop: 2 }}>{scope == null ? tr('where candidates are right now, all jobs') : `${tr('where candidates are right now')} · ${scope}`}</Txt>
                <View style={{ gap: 10, marginTop: 16 }}>
                  {FUNNEL_GROUPS.map((g) => <BarRow key={g} name={tr(g)} count={counts[g]} max={maxFunnel} color={barColor(t, g)} labelWidth={90} />)}
                </View>
                <Txt size={12} color={t.mut} style={{ marginTop: 14 }}>
                  {tr('screening = screened + reviewed + shortlisted · interview = scheduled, in progress, completed · offer = pending, sent, accepted, declined.')}
                </Txt>
                {truncated && (
                  <Txt size={11.5} color={t.mut2} style={{ marginTop: 8 }} lh={1.5}>
                    {tr('this report covers the most recent jobs — there are more than we can total in one request.')}
                  </Txt>
                )}
              </Card>

              <Card>
                <Txt size={13} weight="700">{tr('hiring efficiency by job')}</Txt>
                <Txt size={11.5} color={t.mut} style={{ marginTop: 2 }}>{tr('time to hire: first application → first accepted offer · time to fill: job posted → first accepted offer')}</Txt>
                <View style={{ marginTop: 12 }}>{effTable}</View>
              </Card>

              {scope != null && (() => {
                const row = scopedRows[0];
                if (!row) return null;
                const g = groupRow(row);
                return (
                  <Card>
                    <Txt size={13} weight="700">{tr('all statuses')} · {scope}</Txt>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                      {(Object.keys(row) as (keyof PipelineRow)[]).filter((k) => k !== 'jobTitle' && typeof row[k] === 'number').map((k) => (
                        <View key={k} style={{ backgroundColor: t.hov, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, flexDirection: 'row', gap: 6 }}>
                          <Txt size={12} color={t.mut}>{String(k).replace(/-/g, ' ')}</Txt>
                          <Txt size={12} weight="700" mono>{row[k] as number}</Txt>
                        </View>
                      ))}
                    </View>
                    <Txt size={11.5} color={t.mut} style={{ marginTop: 10 }}>{activeCount(g)} {tr('active')} · {g.hired} {tr('hired')} · {g.closed} {tr('closed')}</Txt>
                  </Card>
                );
              })()}
            </View>

            <View style={{ flex: 1, gap: 14, minWidth: 0 }}>
              {sections.length > 0 && (
                <Card>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Txt size={13} weight="700">{tr('where hires come from')}</Txt>
                    <View style={{ backgroundColor: t.chip, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8 }}>
                      <Txt size={10} weight="700" mono color={t.ink3}>{tr('platform-wide')}</Txt>
                    </View>
                  </View>
                  <Txt size={11.5} color={t.mut} style={{ marginTop: 2 }}>{tr('public aggregate of hired applications across dear company — not only your organization.')}</Txt>
                  {sections.map((s, i) => {
                    const max = Math.max(...s.bars.map((b) => b.value), 1);
                    return (
                      <View key={`${s.title}-${i}`} style={{ marginTop: 16, gap: 10 }}>
                        {s.title ? <Txt size={11.5} weight="700" color={t.mut} style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.title}</Txt> : null}
                        {s.bars.map((b) => <BarRow key={b.label} name={b.label} count={b.value} max={max} color={t.chip} labelWidth={90} />)}
                      </View>
                    );
                  })}
                </Card>
              )}
              <Card>
                <Txt size={13} weight="700">{tr('coming soon')}</Txt>
                <Txt size={12.5} color={t.mut} lh={1.55} style={{ marginTop: 6 }}>
                  {tr('average days in stage, weekly time-to-hire trend, per-recruiter reports and csv export need reporting endpoints the backend does not expose yet.')}
                </Txt>
              </Card>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}
