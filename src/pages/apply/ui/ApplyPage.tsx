import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { applicationsApi, type CoverLetterDocument, type JobApplicationStatus, type ResumeDocument } from '@/entities/application';
import { jobsApi, type Job } from '@/entities/job';
import { ApiError, errorMessageFrom } from '@/shared/api';
import { useBreakpoint } from '@/shared/lib/responsive';
import { useT } from '@/shared/lib/useT';
import { accent, accentInk, danger, link, useTheme } from '@/shared/theme';
import { Btn, Card, Txt } from '@/shared/ui';
import { AppliedMark } from './AppliedMark';

type Loaded = {
  job: Job;
  status: JobApplicationStatus;
  resume: ResumeDocument | null;
  coverLetters: CoverLetterDocument[];
  selectedCover: CoverLetterDocument | null;
};

/** /apply?job=<id> — the design's 3-step letter flow (seeker.html 1062–1197) on the real ATS endpoints. */
export function ApplyPage() {
  const { job: jobParam } = useLocalSearchParams<{ job?: string }>();
  const jobId = typeof jobParam === 'string' ? jobParam : '';
  const router = useRouter();
  const t = useTheme();
  const tr = useT();
  const { isMobile, gutter } = useBreakpoint();

  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [coverId, setCoverId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const alive = useRef(true);

  const failMsg = useCallback(
    (e: unknown): string =>
      e instanceof ApiError && e.isNetworkError
        ? tr('could not reach the server. check your connection and try again.')
        : errorMessageFrom((e as { payload?: unknown }).payload, (e as Error).message),
    [tr],
  );

  const load = useCallback(async () => {
    if (!jobId) {
      setLoading(false);
      setLoadError(tr('no job was given — open a job and press apply.'));
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [job, status, docs, covers] = await Promise.all([
        jobsApi.getJob(jobId),
        applicationsApi.getJobStatus(jobId),
        applicationsApi.getSelectedDocs(),
        applicationsApi.listCoverLetters(),
      ]);
      if (!alive.current) return;
      if (!job) {
        setLoadError(tr('this job is no longer available.'));
        return;
      }
      setData({ job, status, resume: docs.resume, coverLetters: covers, selectedCover: docs.cover_letter });
      setCoverId(docs.cover_letter?.id ?? null);
    } catch (e) {
      if (alive.current) setLoadError(failMsg(e));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [failMsg, jobId, tr]);

  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  const company = data?.job.organization?.name ?? tr('the company');
  const steps = [tr('your cv'), tr('your note'), tr('send it')];
  const chosenCover = data?.coverLetters.find((c) => c.id === coverId) ?? null;

  const submit = async () => {
    if (!data || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await applicationsApi.applyToJob({
        job: data.job.id,
        resume: data.resume?.id,
        cover_letter: chosenCover?.id,
        auto_apply: false,
      });
      if (alive.current) setDone(true);
    } catch (e) {
      if (alive.current) setSubmitError(failMsg(e));
    } finally {
      if (alive.current) setSubmitting(false);
    }
  };

  const goJob = () => router.push(`/job/${jobId}` as never);
  const goCv = () => router.push('/cv' as never);
  const goApplications = () => router.push('/applications' as never);
  const goJobs = () => router.push('/jobs' as never);

  const next = () => {
    if (step < 2) setStep(step + 1);
    else void submit();
  };
  const back = () => {
    if (step === 0) goJob();
    else setStep(step - 1);
  };
  const nextDisabled = (step === 0 && !data?.resume) || submitting;

  const docRow = (label: string, value: string, ok: boolean, okLabel: string) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1.5,
        borderColor: t.chip,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
      }}
    >
      <Txt size={12} weight="700" color={t.mut2} style={{ width: 60 }}>
        {label}
      </Txt>
      <Txt size={13.5} weight={ok ? '600' : '400'} color={ok ? t.ink : t.ink2} style={{ flex: 1 }}>
        {value}
      </Txt>
      <Txt size={12} weight="700" color={ok ? t.green : t.mut2}>
        {ok ? `✓ ${okLabel}` : okLabel}
      </Txt>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={{ paddingVertical: 26, paddingBottom: 44, paddingHorizontal: gutter }}>
      <View style={{ maxWidth: 720, width: '100%', alignSelf: 'center', gap: 16 }}>
        {/* header */}
        <View style={{ gap: 6 }}>
          <Txt size={13} color={t.mut2}>
            {data ? `${tr('applying to')} ${data.job.title} · ${company}` : tr('applying')}
          </Txt>
          <Txt size={isMobile ? 26 : 38} weight="700" ls={-0.04} lh={1.08}>
            {tr('dear')} {company},
          </Txt>
          <View style={{ flexDirection: 'row' }}>
            <View
              style={{
                backgroundColor: accent,
                borderRadius: 10,
                paddingHorizontal: 12,
                transform: [{ rotate: '-1.2deg' }],
              }}
            >
              <Txt size={isMobile ? 26 : 38} weight="700" ls={-0.04} lh={1.08} color={accentInk}>
                {tr("here's my letter")}
              </Txt>
            </View>
          </View>
        </View>

        {loading && (
          <View style={{ paddingVertical: 40, alignItems: 'center', gap: 10 }}>
            <ActivityIndicator color={t.ink} />
            <Txt size={13} color={t.mut}>
              {tr('checking your cv and this job…')}
            </Txt>
          </View>
        )}

        {!loading && loadError && (
          <Card radius={22} padding={26} gap={12}>
            <Txt size={14} color={danger}>
              {loadError}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              {jobId ? <Btn label={tr('try again')} variant="accent" onPress={() => void load()} /> : null}
              <Btn label={tr('back to the feed')} variant="muted" onPress={goJobs} />
            </View>
          </Card>
        )}

        {/* already applied */}
        {!loading && data && data.status.is_applied && !done && (
          <View style={{ backgroundColor: '#141519', borderRadius: 24, padding: 34, alignItems: 'center', gap: 16 }}>
            <AppliedMark />
            <Txt size={26} weight="700" color="#F6F4EE" ls={-0.02} align="center">
              {tr('you already applied here.')}
            </Txt>
            <Txt size={14} color="#a1a1aa" lh={1.6} align="center" style={{ maxWidth: 420 }}>
              {tr('one application per job is all a company needs. its status lives in applications.')}
              {data.status.application?.resume ? ` ${tr('sent with')} ${data.status.application.resume.title}.` : ''}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Btn label={tr('track it in applications')} variant="accent" size={13.5} px={24} onPress={goApplications} />
              <Btn label={tr('back to the job')} bg="transparent" color="#F6F4EE" weight="600" size={13.5} px={18} onPress={goJob} />
            </View>
          </View>
        )}

        {/* steps */}
        {!loading && data && !data.status.is_applied && !done && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {steps.map((label, i) => {
                const doneStep = i < step;
                const active = i === step;
                return (
                  <View
                    key={label}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 7,
                      paddingVertical: 7,
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      backgroundColor: t.card,
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: doneStep ? accent : active ? '#141519' : t.chip,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Txt size={11} weight="700" color={doneStep ? accentInk : active ? accent : t.mut2}>
                        {doneStep ? '✓' : String(i + 1)}
                      </Txt>
                    </View>
                    <Txt size={12.5} weight="600" color={active ? t.ink : t.mut}>
                      {label}
                    </Txt>
                  </View>
                );
              })}
            </View>

            {step === 0 && (
              <Card radius={22} padding={26} gap={16}>
                <View style={{ gap: 4 }}>
                  <Txt size={20} weight="700" ls={-0.02}>
                    {data.resume ? tr('your cv is ready to go') : tr('no cv selected yet')}
                  </Txt>
                  <Txt size={13} color={t.mut} lh={1.55}>
                    {data.resume
                      ? tr('this is the cv you marked as selected on the my cv page. no re-uploading, no retyping into their portal — one cv, done.')
                      : tr('add a cv on the my cv page first — the application is sent with the cv you mark as selected there.')}
                  </Txt>
                </View>
                {data.resume ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 14,
                      borderWidth: 1.5,
                      borderColor: t.chip,
                      borderRadius: 14,
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 48,
                        borderRadius: 6,
                        backgroundColor: t.bg,
                        borderWidth: 1.5,
                        borderColor: t.chip,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Txt size={10} weight="700" color={t.mut}>
                        CV
                      </Txt>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt size={14} weight="700">
                        {data.resume.title}
                      </Txt>
                      <Txt size={12} color={t.mut}>
                        {data.resume.file ? data.resume.file.split('/').pop() : tr('selected cv')}
                      </Txt>
                    </View>
                    <Pressable onPress={goCv} accessibilityRole="link">
                      <Txt size={12.5} weight="600" color={t.mut} style={{ textDecorationLine: 'underline' }}>
                        {tr('swap')}
                      </Txt>
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.bg, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, flexWrap: 'wrap' }}>
                    <Txt size={13} color={t.ink2} lh={1.5} style={{ flex: 1, minWidth: 180 }}>
                      {tr('nothing to attach yet.')}
                    </Txt>
                    <Btn label={tr('go to my cv')} variant="accent" size={12.5} px={14} py={7} radius={9} onPress={goCv} />
                  </View>
                )}
              </Card>
            )}

            {step === 1 && (
              <Card radius={22} padding={26} gap={16}>
                <View style={{ gap: 4 }}>
                  <Txt size={20} weight="700" ls={-0.02}>
                    {tr('a cover letter — optional')}
                  </Txt>
                  <Txt size={13} color={t.mut} lh={1.55}>
                    {tr('pick one of your saved cover letters or send the cv alone. recruiters skim; skipping is also fine.')}
                  </Txt>
                </View>
                {data.coverLetters.length === 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.bg, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, flexWrap: 'wrap' }}>
                    <Txt size={13} color={t.ink2} lh={1.5} style={{ flex: 1, minWidth: 180 }}>
                      {tr('no cover letters yet — you can write or generate one on the my cv page.')}
                    </Txt>
                    <Btn label={tr('go to my cv')} variant="accent" size={12.5} px={14} py={7} radius={9} onPress={goCv} />
                  </View>
                ) : (
                  <View style={{ gap: 8 }}>
                    {data.coverLetters.map((c) => {
                      const on = c.id === coverId;
                      return (
                        <Pressable
                          key={c.id}
                          onPress={() => setCoverId(on ? null : c.id)}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: on }}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 12,
                            borderWidth: 1.5,
                            borderColor: on ? '#141519' : t.chip,
                            borderRadius: 14,
                            paddingVertical: 12,
                            paddingHorizontal: 16,
                            backgroundColor: on ? t.card2 : t.card,
                          }}
                        >
                          <View
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 9,
                              borderWidth: 1.5,
                              borderColor: on ? '#141519' : t.line,
                              backgroundColor: on ? accent : t.card,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {on ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#141519' }} /> : null}
                          </View>
                          <View style={{ flex: 1, gap: 2 }}>
                            <Txt size={14} weight="700">
                              {c.title}
                            </Txt>
                            <Txt size={12} color={t.mut}>
                              {c.is_ai_generated ? tr('ai generated') : tr('uploaded')}
                              {c.is_selected ? ` · ${tr('selected')}` : ''}
                            </Txt>
                          </View>
                        </Pressable>
                      );
                    })}
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Pressable onPress={() => setCoverId(null)}>
                        <Txt size={12.5} weight="600" color={coverId ? t.mut : t.ink} style={{ paddingVertical: 8, paddingHorizontal: 6 }}>
                          {tr('skip the letter')}
                        </Txt>
                      </Pressable>
                      <Pressable onPress={goCv}>
                        <Txt size={12.5} weight="600" color={link} style={{ paddingVertical: 8, paddingHorizontal: 6 }}>
                          {tr('write a new one on my cv →')}
                        </Txt>
                      </Pressable>
                    </View>
                  </View>
                )}
              </Card>
            )}

            {step === 2 && (
              <Card radius={22} padding={26} gap={16}>
                <View style={{ gap: 4 }}>
                  <Txt size={20} weight="700" ls={-0.02}>
                    {tr('last look, then it flies')}
                  </Txt>
                  <Txt size={13} color={t.mut} lh={1.55}>
                    {tr('everything below goes to')} {company}. {tr('nothing else — no browsing history, no “profile strength”, just this.')}
                  </Txt>
                </View>
                <View style={{ gap: 8 }}>
                  {docRow(tr('cv'), data.resume?.title ?? tr('none'), !!data.resume, tr('ready'))}
                  {docRow(tr('letter'), chosenCover?.title ?? tr('no cover letter — cv only'), !!chosenCover, chosenCover ? tr('attached') : tr('skipped'))}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: t.chip, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 }}>
                    <Txt size={12} weight="700" color={t.mut2} style={{ width: 60 }}>
                      {tr('then')}
                    </Txt>
                    <Txt size={13.5} color={t.ink2} style={{ flex: 1 }}>
                      {tr('the company sees it in their pipeline. every status change shows up in applications.')}
                    </Txt>
                  </View>
                </View>
                {data.status.withdrawn_count > 0 && (
                  <Txt size={12} color={t.mut}>
                    {tr('you withdrew from this job before')} ({data.status.withdrawn_count}/2). {tr('after two withdrawals the company stops accepting your application.')}
                  </Txt>
                )}
                {submitError && (
                  <Txt size={13} color={danger}>
                    {submitError}
                  </Txt>
                )}
              </Card>
            )}

            {/* nav */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable onPress={back} disabled={submitting}>
                {(s) => (
                  <Txt size={13} weight="600" color={(s as { hovered?: boolean }).hovered ? t.ink : t.mut}>
                    {step === 0 ? tr('← back to the job') : tr('← back')}
                  </Txt>
                )}
              </Pressable>
              <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {submitting ? <ActivityIndicator color={t.ink} /> : null}
                <Btn
                  label={step === 2 ? (submitting ? tr('sending…') : tr('send it 💌')) : tr('next')}
                  variant="accent"
                  px={28}
                  radius={13}
                  disabled={nextDisabled}
                  style={{ opacity: nextDisabled ? 0.5 : 1 }}
                  onPress={next}
                />
              </View>
            </View>
          </>
        )}

        {/* done */}
        {done && (
          <View style={{ backgroundColor: '#141519', borderRadius: 24, padding: 34, alignItems: 'center', gap: 16 }}>
            <AppliedMark />
            <Txt size={26} weight="700" color="#F6F4EE" ls={-0.02} align="center">
              {tr('applied. now we wait — together.')}
            </Txt>
            <Txt size={14} color="#a1a1aa" lh={1.6} align="center" style={{ maxWidth: 420 }}>
              {company} {tr('has your application. when they move it — read, interview, offer — the new status shows up in applications. go do literally anything else.')}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Btn label={tr('track it in applications')} variant="accent" size={13.5} px={24} onPress={goApplications} />
              <Btn label={tr('back to the feed')} bg="transparent" color="#F6F4EE" weight="600" size={13.5} px={18} onPress={goJobs} />
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
