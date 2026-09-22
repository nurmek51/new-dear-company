import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import {
  CLOSED_STAGE,
  PIPELINE_STAGES,
  applicantsApi,
  countByStage,
  stageOf,
  type Applicant,
  type ApplicantsPage,
  type PipelineStage,
  type RecruiterStatus,
} from '@/entities/applicant';
import { candidatePoolApi, type CandidateProfile, type ProfileMatch } from '@/entities/candidate-pool';
import { jobsApi, type Job } from '@/entities/job';
import { ApiError, humanize, pageFromUrl } from '@/shared/api';
import { useBreakpoint } from '@/shared/lib/responsive';
import { useT } from '@/shared/lib/useT';
import { font, accent, link, useTheme } from '@/shared/theme';
import { Overlay, Txt } from '@/shared/ui';
import { Board } from './Board';
import { CandidateDetail, ProfileBody } from './CandidateDetail';
import { Avatar, OutlineBtn, StatusPill, Toast, fmtDate, useToast } from './pipelineUi';
import { MoveModal, RejectModal } from './StatusModals';

type View_ = 'list' | 'board';

function jobLife(job: Job): { label: string; bg: string; color: string; dot: string | null } {
  if (!job.published_at) return { label: 'draft', bg: '#FFFBEB', color: '#b45309', dot: null };
  if (job.date_validthrough && new Date(job.date_validthrough).getTime() < Date.now()) return { label: 'expired', bg: '#ECE9E0', color: '#52525b', dot: null };
  return { label: 'open', bg: '#DCF2E3', color: '#166534', dot: '#16a34a' };
}

/**
 * Job pipeline console (recruiter.html 326–507). KEEP: header with stage
 * chips + counts, list/board toggle, split list + detail, board columns,
 * reject modal, client toast. ADAPT: stage groups map onto the real
 * ApplicationStatus enum; drag → "move to ▾" (POST update-status); comments →
 * timeline notes (update-status with the same status). HIDE (no endpoint):
 * edit stages, drafts, upload cv, add candidate, bulk email, scorecards,
 * checkboxes/bulk actions, feedback-overdue flags.
 */
export function RecruiterJobPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = typeof id === 'string' ? id : '';
  const t = useTheme();
  const tr = useT();
  const bp = useBreakpoint();
  const router = useRouter();
  const toast = useToast();
  const gutter = bp.isMobile ? 12 : 26;

  const [job, setJob] = useState<Job | null | undefined>(undefined);
  const [jobErr, setJobErr] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<ApplicantsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View_>('list');
  const [stage, setStage] = useState<PipelineStage>('applied');
  const [selId, setSelId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [moveOpen, setMoveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [acting, setActing] = useState(false);
  const [actErr, setActErr] = useState<string | null>(null);

  const [matches, setMatches] = useState<ProfileMatch[] | null>(null);
  const [matchErr, setMatchErr] = useState<string | null>(null);
  const [peek, setPeek] = useState<{ match: ProfileMatch; profile: CandidateProfile | null | undefined; err: string | null } | null>(null);

  const loadJob = useCallback(async () => {
    setJobErr(null);
    setJob(undefined);
    try {
      setJob(await jobsApi.getJob(jobId));
    } catch (e) {
      setJobErr(e instanceof ApiError ? e.message : tr('could not load the job'));
    }
  }, [jobId, tr]);

  const loadApplicants = useCallback(async (p: number, q: string, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await applicantsApi.listApplicants(jobId, { page: p, search: q || undefined });
      setData(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : tr('could not load applicants. check your connection and retry.'));
    } finally {
      setLoading(false);
    }
  }, [jobId, tr]);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    (async () => {
      if (!cancelled) await loadJob();
    })();
    return () => { cancelled = true; };
  }, [jobId, loadJob]);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    (async () => {
      if (!cancelled) await loadApplicants(page, query);
    })();
    return () => { cancelled = true; };
  }, [jobId, page, query, loadApplicants]);

  useEffect(() => {
    if (!job?.show_profile_matches) return;
    let cancelled = false;
    (async () => {
      try {
        const m = await candidatePoolApi.matchProfilesForJob(jobId, 5);
        if (!cancelled) setMatches(m);
      } catch (e) {
        if (!cancelled) setMatchErr(e instanceof ApiError ? e.message : tr('matches unavailable'));
      }
    })();
    return () => { cancelled = true; };
  }, [job?.show_profile_matches, jobId, tr]);

  const rows = useMemo(() => data?.results ?? [], [data]);
  const counts = useMemo(() => countByStage(data?.summary ?? { total_applicants: 0 }), [data]);
  const inStage = useMemo(() => rows.filter((r) => stageOf(r.status) === stage), [rows, stage]);
  const sel = useMemo(() => rows.find((r) => r.id === selId) ?? null, [rows, selId]);

  useEffect(() => {
    if (view !== 'list') return;
    if (sel && stageOf(sel.status) === stage) return;
    setSelId(inStage[0]?.id ?? null);
  }, [inStage, sel, stage, view]);

  const applyStatus = async (a: Applicant, status: RecruiterStatus, notes: string, action: string) => {
    setActing(true);
    setActErr(null);
    try {
      await applicantsApi.updateStatus(a.id, { status, notes: notes || undefined, action });
      setData((d) => (d ? { ...d, results: d.results.map((r) => (r.id === a.id ? { ...r, status } : r)) } : d));
      setRefreshKey((k) => k + 1);
      setMoveOpen(false);
      setRejectOpen(false);
      toast.show(status === 'rejected' ? `${tr('rejected')} ${a.name}${notes ? ` — ${notes}` : ''}` : `${tr('moved')} ${a.name} ${tr('to')} ${humanize(status)}`);
      const nextStage = stageOf(status);
      if (nextStage !== stage) setStage(nextStage);
      setSelId(a.id);
      await loadApplicants(page, query, true);
    } catch (e) {
      setActErr(e instanceof ApiError ? e.message : tr('could not update the status'));
    } finally {
      setActing(false);
    }
  };

  const openCandidate = (a: Applicant) => {
    setStage(stageOf(a.status));
    setSelId(a.id);
    setView('list');
  };

  const openPeek = async (m: ProfileMatch) => {
    setPeek({ match: m, profile: undefined, err: null });
    try {
      const p = await candidatePoolApi.getCandidateProfile(m.profile_id);
      setPeek((cur) => (cur && cur.match.profile_id === m.profile_id ? { ...cur, profile: p } : cur));
    } catch (e) {
      setPeek((cur) => (cur && cur.match.profile_id === m.profile_id ? { ...cur, err: e instanceof ApiError ? e.message : tr('could not load the profile') } : cur));
    }
  };

  const nextPage = pageFromUrl(data?.next ?? null);
  const prevPage = data?.previous ? pageFromUrl(data.previous) ?? 1 : null;
  const chips: PipelineStage[] = [...PIPELINE_STAGES, CLOSED_STAGE];

  if (!jobId || job === null) {
    return (
      <View style={{ padding: gutter, gap: 10 }}>
        <Txt size={19} weight="700">{tr('job not found')}</Txt>
        <Pressable onPress={() => router.push('/recruiter/jobs' as never)}><Txt size={13} weight="600" color={link}>{tr('← back to jobs')}</Txt></Pressable>
      </View>
    );
  }

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, rowGap: 8, paddingVertical: 14, paddingHorizontal: gutter, borderBottomWidth: 1, borderBottomColor: t.l09, flexWrap: 'wrap' }}>
      {job === undefined ? (
        jobErr ? (
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Txt size={13} color={t.mut}>{jobErr}</Txt>
            <OutlineBtn label={tr('retry')} onPress={loadJob} />
          </View>
        ) : (
          <ActivityIndicator color={t.mut} />
        )
      ) : (
        <>
          <Txt size={19} weight="700" ls={-0.02}>{job.title}</Txt>
          {(() => {
            const life = jobLife(job);
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: life.bg, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999 }}>
                {life.dot ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: life.dot }} /> : null}
                <Txt size={11.5} weight="600" color={life.color}>{tr(life.label)}</Txt>
              </View>
            );
          })()}
          <Txt size={12} color={t.mut}>
            {[job.department, job.job_locations.map((l) => l.locality ?? l.country).filter(Boolean).join(', ') || (job.work_format ? humanize(String(job.work_format)) : null), job.date_posted ? `${tr('posted')} ${fmtDate(job.date_posted)}` : null]
              .filter(Boolean)
              .join(' · ')}
          </Txt>
        </>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, maxWidth: '100%' }} contentContainerStyle={{ flexDirection: 'row', gap: 8, marginLeft: bp.isMobile ? 0 : 10 }}>
        {chips.map((c) => {
          const act = stage === c;
          return (
            <Pressable
              key={c}
              onPress={() => { setStage(c); setView('list'); }}
              accessibilityRole="tab"
              accessibilityState={{ selected: act }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, paddingTop: 5, paddingBottom: 5, paddingRight: 8, paddingLeft: 13, backgroundColor: act ? '#141519' : t.card, borderWidth: 1, borderColor: act ? '#141519' : t.l12 }}
            >
              <Txt size={12} weight="600" color={act ? accent : t.ink} style={{ whiteSpace: 'nowrap' } as never}>{tr(c === 'closed' ? 'rejected / withdrawn' : c)}</Txt>
              <View style={{ backgroundColor: act ? 'rgba(179,242,66,.25)' : '#ECE9E0', borderRadius: 99, paddingVertical: 1, paddingHorizontal: 7 }}>
                <Txt size={10.5} weight="700" mono color={act ? accent : '#52525b'}>{String(counts[c])}</Txt>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ marginLeft: bp.isMobile ? 0 : 'auto', flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.card, borderWidth: 1, borderColor: t.l12, borderRadius: 9, paddingHorizontal: 12, width: bp.isMobile ? '100%' : 220, height: 36 }}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => { setPage(1); setQuery(search.trim()); }}
            placeholder={tr('name or email…')}
            placeholderTextColor={t.mut2}
            accessibilityLabel={tr('search applicants')}
            style={{ flex: 1, fontSize: 12.5, fontFamily: font.regular, color: t.ink, minWidth: 0, outlineStyle: 'none' } as never}
          />
          {query ? (
            <Pressable onPress={() => { setSearch(''); setQuery(''); setPage(1); }} accessibilityRole="button" accessibilityLabel={tr('clear search')}>
              <Txt size={12} color={t.mut2}>✕</Txt>
            </Pressable>
          ) : null}
        </View>
        <OutlineBtn label={tr('public page ↗')} onPress={() => router.push(`/job/${jobId}` as never)} />
        <OutlineBtn label={tr('edit job')} onPress={() => router.push(`/recruiter/new-job?edit=${jobId}` as never)} />
        <View style={{ flexDirection: 'row', backgroundColor: t.chip, borderRadius: 9, padding: 3 }}>
          {(['list', 'board'] as View_[]).map((v) => (
            <Pressable
              key={v}
              onPress={() => setView(v)}
              accessibilityRole="tab"
              accessibilityState={{ selected: view === v }}
              style={{ paddingVertical: 4, paddingHorizontal: 12, borderRadius: 7, backgroundColor: view === v ? t.card : 'transparent', ...(view === v ? { shadowColor: '#141519', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 } : null) }}
            >
              <Txt size={12} weight="600" color={view === v ? t.ink : t.mut}>{tr(v)}</Txt>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );

  const pager = (
    <View style={{ marginTop: 'auto', paddingVertical: 14, paddingHorizontal: 18, borderTopWidth: 1, borderTopColor: t.l06, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <Txt size={12} color={t.mut} style={{ flex: 1 }}>
        {data ? `${inStage.length} ${tr('on this page')} · ${counts[stage]} ${tr('in stage')} · ${data.summary.total_applicants} ${tr('total')}` : ''}
      </Txt>
      {prevPage != null ? <Pressable onPress={() => setPage(prevPage)} accessibilityRole="button"><Txt size={12} weight="600" color={link}>{tr('← prev')}</Txt></Pressable> : null}
      {nextPage != null ? <Pressable onPress={() => setPage(nextPage)} accessibilityRole="button"><Txt size={12} weight="600" color={link}>{tr('next →')}</Txt></Pressable> : null}
    </View>
  );

  const listPane = (
    <View style={{ width: bp.isMobile ? '100%' : 330, maxHeight: bp.isMobile ? Math.round(bp.height * 0.44) : undefined, borderRightWidth: bp.isMobile ? 0 : 1, borderRightColor: t.l09, borderBottomWidth: bp.isMobile ? 1 : 0, borderBottomColor: t.l09 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {loading ? (
          <View style={{ padding: 30, alignItems: 'center' }}><ActivityIndicator color={t.mut} /></View>
        ) : error ? (
          <View style={{ padding: 18, gap: 10, alignItems: 'flex-start' }}>
            <Txt size={13} color={t.mut}>{error}</Txt>
            <OutlineBtn label={tr('retry')} onPress={() => loadApplicants(page, query)} />
          </View>
        ) : inStage.length === 0 ? (
          <View style={{ paddingVertical: 30, paddingHorizontal: 18 }}>
            <Txt size={13} color={t.mut} align="center">{query ? tr('no one matches this search on this page') : tr('nobody in this stage yet')}</Txt>
          </View>
        ) : (
          inStage.map((a) => {
            const active = a.id === selId;
            return (
              <Pressable
                key={a.id}
                onPress={() => setSelId(a.id)}
                accessibilityRole="button"
                accessibilityLabel={a.name}
                accessibilityState={{ selected: active }}
                style={(s) => ({
                  flexDirection: 'row',
                  gap: 12,
                  alignItems: 'center',
                  paddingTop: 14,
                  paddingBottom: 14,
                  paddingRight: 14,
                  paddingLeft: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: t.l06,
                  backgroundColor: active || (s as { hovered?: boolean }).hovered ? t.card : 'transparent',
                  borderLeftWidth: 3,
                  borderLeftColor: active ? '#141519' : 'transparent',
                })}
              >
                <Avatar name={a.name} uri={a.profile_picture} size={36} fontSize={13} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt size={13.5} weight="600">{a.name || tr('candidate')}</Txt>
                  <Txt size={11.5} color={t.mut}>
                    {[a.match_score != null ? `${Math.round(a.match_score)}% ${tr('match')}` : null, a.applied_at ? `${tr('applied')} ${fmtDate(a.applied_at)}` : null].filter(Boolean).join(' · ')}
                  </Txt>
                </View>
                <StatusPill status={a.status} size={10.5} />
              </Pressable>
            );
          })
        )}
        {pager}
      </ScrollView>
    </View>
  );

  const emptyDetail = (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 400, padding: 28, gap: 22 }}>
      <Txt size={13} color={t.mut2}>{loading ? '' : tr('select a candidate on the left')}</Txt>
      {job?.show_profile_matches && (matches === null ? !matchErr : matches.length > 0) ? (
        <View style={{ width: '100%', maxWidth: 520, borderWidth: 1, borderColor: t.l10, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 18, gap: 10 }}>
          <Txt size={12} weight="700" color={t.mut} ls={0.05} style={{ textTransform: 'uppercase' }}>{tr('top matches from the talent pool ✦')}</Txt>
          {matches === null ? (
            <ActivityIndicator color={t.mut} />
          ) : (
            matches.map((m) => (
              <Pressable key={m.profile_id} onPress={() => openPeek(m)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Avatar name={m.name ?? m.profile_id} size={28} fontSize={10.5} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt size={13} weight="600">{m.name ?? tr('candidate')}</Txt>
                  {m.heading ? <Txt size={11.5} color={t.mut}>{m.heading}</Txt> : null}
                </View>
                {m.score != null ? <Txt size={11} weight="700" mono>{`${Math.round(m.score)}%`}</Txt> : null}
                <Txt size={12} weight="600" color={link}>{tr('view →')}</Txt>
              </Pressable>
            ))
          )}
          <Txt size={11} color={t.mut2}>{tr('public pool data (spec §4.3) — inviting to this job is not available yet')}</Txt>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {header}
      {view === 'board' ? (
        loading ? (
          <View style={{ padding: 30, alignItems: 'center' }}><ActivityIndicator color={t.mut} /></View>
        ) : error ? (
          <View style={{ padding: 18, gap: 10, alignItems: 'flex-start' }}>
            <Txt size={13} color={t.mut}>{error}</Txt>
            <OutlineBtn label={tr('retry')} onPress={() => loadApplicants(page, query)} />
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <Board rows={rows} activeStage={stage} onOpen={openCandidate} />
            <View style={{ paddingHorizontal: gutter, paddingBottom: 14, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Txt size={12} color={t.mut} style={{ flex: 1 }}>{data ? `${rows.length} ${tr('on this page')} · ${data.summary.total_applicants} ${tr('total')}` : ''}</Txt>
              {prevPage != null ? <Pressable onPress={() => setPage(prevPage)} accessibilityRole="button"><Txt size={12} weight="600" color={link}>{tr('← prev')}</Txt></Pressable> : null}
              {nextPage != null ? <Pressable onPress={() => setPage(nextPage)} accessibilityRole="button"><Txt size={12} weight="600" color={link}>{tr('next →')}</Txt></Pressable> : null}
            </View>
          </View>
        )
      ) : (
        <View style={{ flex: 1, flexDirection: bp.isMobile ? 'column' : 'row', minHeight: 0 }}>
          {listPane}
          <ScrollView style={{ flex: 1, backgroundColor: t.card }} contentContainerStyle={{ flexGrow: 1 }}>
            {sel ? (
              <CandidateDetail
                applicant={sel}
                refreshKey={refreshKey}
                onMove={() => { setActErr(null); setMoveOpen(true); }}
                onReject={() => { setActErr(null); setRejectOpen(true); }}
                onNoteAdded={(m) => toast.show(m)}
              />
            ) : (
              emptyDetail
            )}
          </ScrollView>
        </View>
      )}

      {sel ? (
        <>
          <MoveModal
            name={sel.name}
            current={String(sel.status)}
            visible={moveOpen}
            busy={acting}
            error={actErr}
            onCancel={() => setMoveOpen(false)}
            onConfirm={(status, notes) => applyStatus(sel, status, notes, 'status_change')}
          />
          <RejectModal
            name={sel.name}
            visible={rejectOpen}
            busy={acting}
            error={actErr}
            onCancel={() => setRejectOpen(false)}
            onConfirm={(notes) => applyStatus(sel, 'rejected', notes, 'reject')}
          />
        </>
      ) : null}

      <Overlay visible={!!peek} onClose={() => setPeek(null)} width={520} radius={18} padding={24}>
        {peek ? (
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={peek.match.name ?? peek.match.profile_id} size={44} radius={14} fontSize={15} />
              <View style={{ flex: 1 }}>
                <Txt size={17} weight="700" ls={-0.02}>{peek.match.name ?? tr('candidate')}</Txt>
                {peek.match.score != null ? <Txt size={12} color={t.mut}>{`${Math.round(peek.match.score)}% ${tr('match')}`}</Txt> : null}
              </View>
              <Pressable onPress={() => setPeek(null)} accessibilityRole="button" accessibilityLabel={tr('close')}><Txt size={14} color={t.mut2}>✕</Txt></Pressable>
            </View>
            {peek.profile === undefined && !peek.err ? (
              <ActivityIndicator color={t.mut} />
            ) : peek.err ? (
              <Txt size={12.5} color={t.mut}>{peek.err}</Txt>
            ) : peek.profile ? (
              <ProfileBody profile={peek.profile} />
            ) : (
              <Txt size={12.5} color={t.mut2}>{tr('no public profile for this candidate')}</Txt>
            )}
            {peek.match.top_strengths.length || peek.match.skill_matches.length ? (
              <Txt size={12.5} color={t.ink2} lh={1.5}>
                <Txt size={12.5} weight="600" color="#16a34a">{`${tr('strengths')}: `}</Txt>
                {[...peek.match.top_strengths.map((s) => s.why || humanize(s.criterion)), ...peek.match.skill_matches].join(' · ')}
              </Txt>
            ) : null}
          </View>
        ) : null}
      </Overlay>

      <Toast msg={toast.msg} />
    </View>
  );
}
