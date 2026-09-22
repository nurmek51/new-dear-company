import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { jobsApi, type Job } from '@/entities/job';
import { Toast, useToast } from '@/pages/recruiter-job';
import { EMPLOYMENT_TYPES, ENGLISH_LEVELS, GRADES, WORK_FORMATS, ApiError, humanize } from '@/shared/api';
import { useBreakpoint } from '@/shared/lib/responsive';
import { useT } from '@/shared/lib/useT';
import { accent, danger, link, useTheme } from '@/shared/theme';
import { Overlay, Txt } from '@/shared/ui';
import { emptyJobForm, fromJob, toWriteInput, validateJobForm, type JobForm, type JobFormErrors } from '../model/jobForm';
import { AiAssistCard } from './AiAssistCard';
import { FieldBlock, FormCard, Input, PickChip, StepHeader } from './formUi';

/**
 * New / edit job (recruiter.html 1116–1207). KEEP: breadcrumb, h1, card 1
 * "basics" (title, team, work format, employment, experience level,
 * description), publish / save-draft actions. ADAPT: the prototype's chip
 * values become the API enums (work_format, employment_type, grade); the
 * spec's remaining writable fields (skills, english level, years,
 * qualifications, highlights, screening questions, valid-through) form card 2.
 * HIDE: salary range (needs an existing salary_id — nothing creates one),
 * location (needs job_location_ids — nothing creates one; no free-text field
 * exists on the Job), pipeline-stages editor + templates (statuses are a fixed
 * server enum), hiring team + invite (no endpoint), "continue a draft" chips
 * (drafts are real jobs with published_at = null — they live in the jobs list).
 */
export function RecruiterNewJobPage() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const editId = typeof edit === 'string' && edit ? edit : null;
  const t = useTheme();
  const tr = useT();
  const bp = useBreakpoint();
  const router = useRouter();
  const toast = useToast();
  const gutter = bp.isMobile ? 12 : 26;

  const [form, setForm] = useState<JobForm>(emptyJobForm);
  const [errors, setErrors] = useState<JobFormErrors>({});
  const [existing, setExisting] = useState<Job | null>(null);
  const [loading, setLoading] = useState(!!editId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const patch = useCallback((p: Partial<JobForm>) => setForm((f) => ({ ...f, ...p })), []);

  const loadExisting = useCallback(async (id: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const j = await jobsApi.getJob(id);
      if (!j) {
        setLoadError(tr('this job no longer exists.'));
        return;
      }
      setExisting(j);
      setForm(fromJob(j));
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : tr('could not load the job. check your connection and retry.'));
    } finally {
      setLoading(false);
    }
  }, [tr]);

  useEffect(() => {
    if (editId) void loadExisting(editId);
    else {
      setExisting(null);
      setForm(emptyJobForm());
      setLoading(false);
    }
  }, [editId, loadExisting]);

  const wasPublished = !!existing?.published_at;

  const submit = async (publish: boolean) => {
    if (submitting) return;
    const errs = validateJobForm(form);
    setErrors(errs);
    if (Object.keys(errs).length) {
      setSubmitError(tr('fix the highlighted fields first.'));
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const input = toWriteInput({ ...form, publish }, { wasPublished });
      const saved = existing ? await jobsApi.updateJob(existing.id, input) : await jobsApi.createJob(input);
      router.replace(`/recruiter/job/${saved.id}` as never);
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : tr('could not save the job. check your connection and retry.'));
      setSubmitting(false);
    }
  };

  const remove = async () => {
    if (!existing || deleting) return;
    setDeleting(true);
    try {
      await jobsApi.deleteJob(existing.id);
      router.replace('/recruiter/jobs' as never);
    } catch (e) {
      setDeleting(false);
      setConfirmDelete(false);
      toast.show(e instanceof ApiError ? e.message : tr('could not delete the job.'));
    }
  };

  const title = existing ? tr('edit job') : tr('new job');
  const col = bp.isMobile ? '100%' : undefined;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ width: '100%', maxWidth: 880, alignSelf: 'center', paddingTop: 28, paddingHorizontal: gutter }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12 }}>
            <Pressable onPress={() => router.push('/recruiter/jobs' as never)} accessibilityRole="link">
              <Txt size={12} color={link}>{tr('jobs')}</Txt>
            </Pressable>
            <Txt size={12} color={t.mut}>/</Txt>
            <Txt size={12} color={t.mut}>{title}</Txt>
          </View>
          <Txt size={bp.isMobile ? 22 : 24} weight="700" ls={-0.03} style={{ marginTop: 8 }}>{title}</Txt>
          <Txt size={13} color={t.mut} style={{ marginTop: 4 }}>
            {existing ? tr('changes go live as soon as you save.') : tr('a title and a description and you are live. everything is editable later.')}
          </Txt>

          {loading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator color={t.mut} />
            </View>
          ) : loadError ? (
            <FormCard style={{ marginTop: 20, gap: 10, alignItems: 'flex-start' }}>
              <Txt size={13} color={t.mut}>{loadError}</Txt>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                {editId ? (
                  <Pressable onPress={() => void loadExisting(editId)} accessibilityRole="button"><Txt size={12.5} weight="600" color={link}>{tr('retry')}</Txt></Pressable>
                ) : null}
                <Pressable onPress={() => router.push('/recruiter/jobs' as never)} accessibilityRole="button"><Txt size={12.5} weight="600" color={link}>{tr('back to jobs')}</Txt></Pressable>
              </View>
            </FormCard>
          ) : (
            <>
              {!existing ? (
                <View style={{ marginTop: 20 }}>
                  <AiAssistCard
                    disabled={submitting}
                    onDraft={(d) => {
                      patch(d);
                      setErrors({});
                      toast.show(tr('ai draft loaded — review every field before publishing'));
                    }}
                  />
                </View>
              ) : null}

              {/* ---- 1 · basics ---- */}
              <FormCard style={{ marginTop: existing ? 20 : 14 }}>
                <StepHeader n="1" title={tr('basics')} />
                <View style={{ flexDirection: bp.isMobile ? 'column' : 'row', gap: 12, marginTop: 16 }}>
                  <FieldBlock label={tr('job title *')} error={errors.title} style={{ flex: bp.isMobile ? undefined : 2, width: col }}>
                    <Input value={form.title} onChangeText={(v) => patch({ title: v })} placeholder={tr('e.g. Product Designer')} label={tr('job title')} />
                  </FieldBlock>
                  <FieldBlock label={tr('team')} style={{ flex: bp.isMobile ? undefined : 1, width: col }}>
                    <Input value={form.department} onChangeText={(v) => patch({ department: v })} placeholder={tr('e.g. Product')} label={tr('team')} />
                  </FieldBlock>
                  <FieldBlock label={tr('years of experience')} error={errors.experience_required} style={{ flex: bp.isMobile ? undefined : 1, width: col }}>
                    <Input value={form.experience_required} onChangeText={(v) => patch({ experience_required: v })} placeholder={tr('e.g. 3')} keyboard="numeric" label={tr('years of experience')} />
                  </FieldBlock>
                </View>

                <View style={{ flexDirection: bp.isMobile ? 'column' : 'row', gap: 12, marginTop: 12 }}>
                  <FieldBlock label={tr('work format')} style={{ flex: bp.isMobile ? undefined : 1, width: col }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                      {WORK_FORMATS.map((w) => (
                        <PickChip key={w} label={tr(w)} active={form.work_format === w} onPress={() => patch({ work_format: w, remote_option: w !== 'onsite' })} />
                      ))}
                    </View>
                  </FieldBlock>
                  <FieldBlock label={tr('employment')} style={{ flex: bp.isMobile ? undefined : 2, width: col }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                      {EMPLOYMENT_TYPES.map((e) => (
                        <PickChip key={e} label={tr(humanize(e))} active={form.employment_type === e} onPress={() => patch({ employment_type: e })} />
                      ))}
                    </View>
                  </FieldBlock>
                </View>

                <FieldBlock label={tr('experience level')} style={{ marginTop: 12 }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                    {GRADES.map((g) => (
                      <PickChip key={g} label={tr(humanize(g))} active={form.grade === g} onPress={() => patch({ grade: form.grade === g ? null : g })} />
                    ))}
                  </View>
                </FieldBlock>

                <FieldBlock label={tr('english level')} style={{ marginTop: 12 }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                    {ENGLISH_LEVELS.map((l) => (
                      <PickChip key={l} label={l} active={form.english_level === l} onPress={() => patch({ english_level: form.english_level === l ? null : l })} />
                    ))}
                  </View>
                </FieldBlock>

                <FieldBlock label={tr('description *')} error={errors.description_text} style={{ marginTop: 12 }}>
                  <Input
                    value={form.description_text}
                    onChangeText={(v) => patch({ description_text: v })}
                    multiline
                    minHeight={96}
                    label={tr('description')}
                    placeholder={tr('paste your job description, or write it here — the public job page uses this text as is.')}
                  />
                </FieldBlock>
              </FormCard>

              {/* ---- 2 · details ---- */}
              <FormCard style={{ marginTop: 14 }}>
                <StepHeader n="2" title={tr('details')} hint={tr('all optional · shown on the public job page')} />
                <FieldBlock label={tr('skills')} style={{ marginTop: 16 }}>
                  <Input value={form.skills} onChangeText={(v) => patch({ skills: v })} placeholder={tr('comma separated, e.g. figma, prototyping, design systems')} label={tr('skills')} />
                </FieldBlock>
                <FieldBlock label={tr('responsibilities')} style={{ marginTop: 12 }}>
                  <Input value={form.responsibilities} onChangeText={(v) => patch({ responsibilities: v })} multiline minHeight={64} label={tr('responsibilities')} placeholder={tr('what the person will own')} />
                </FieldBlock>
                <View style={{ flexDirection: bp.isMobile ? 'column' : 'row', gap: 12, marginTop: 12 }}>
                  <FieldBlock label={tr('qualifications')} style={{ flex: bp.isMobile ? undefined : 1, width: col }}>
                    <Input value={form.qualifications} onChangeText={(v) => patch({ qualifications: v })} multiline minHeight={80} label={tr('qualifications')} placeholder={tr('one per line')} />
                  </FieldBlock>
                  <FieldBlock label={tr('highlights')} style={{ flex: bp.isMobile ? undefined : 1, width: col }}>
                    <Input value={form.highlights} onChangeText={(v) => patch({ highlights: v })} multiline minHeight={80} label={tr('highlights')} placeholder={tr('one per line')} />
                  </FieldBlock>
                </View>
                <FieldBlock label={tr('screening questions')} style={{ marginTop: 12 }}>
                  <Input
                    value={form.auto_screening_questions}
                    onChangeText={(v) => patch({ auto_screening_questions: v })}
                    multiline
                    minHeight={64}
                    label={tr('screening questions')}
                    placeholder={tr('one per line — applicants answer these when they apply')}
                  />
                </FieldBlock>
                <View style={{ flexDirection: bp.isMobile ? 'column' : 'row', gap: 12, marginTop: 12 }}>
                  <FieldBlock label={tr('open until')} error={errors.date_validthrough} style={{ width: bp.isMobile ? '100%' : 200 }}>
                    <Input value={form.date_validthrough} onChangeText={(v) => patch({ date_validthrough: v })} placeholder="YYYY-MM-DD" label={tr('open until')} />
                  </FieldBlock>
                  <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                    <Txt size={12} color={t.mut}>{tr('leave empty to keep the job open until you close it.')}</Txt>
                  </View>
                </View>
              </FormCard>

              {/* ---- actions ---- */}
              {submitError ? <Txt size={12.5} color={danger} style={{ marginTop: 14 }}>{submitError}</Txt> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
                {wasPublished ? (
                  <Pressable
                    onPress={submitting ? undefined : () => void submit(true)}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: submitting }}
                    style={(s) => ({ backgroundColor: (s as { hovered?: boolean }).hovered && !submitting ? '#26272e' : '#141519', paddingVertical: 11, paddingHorizontal: 22, borderRadius: 10, opacity: submitting ? 0.6 : 1 })}
                  >
                    <Txt size={13.5} weight="600" color={accent}>{submitting ? tr('saving…') : tr('save changes')}</Txt>
                  </Pressable>
                ) : (
                  <>
                    <Pressable
                      onPress={submitting ? undefined : () => void submit(true)}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: submitting }}
                      style={(s) => ({ backgroundColor: (s as { hovered?: boolean }).hovered && !submitting ? '#26272e' : '#141519', paddingVertical: 11, paddingHorizontal: 22, borderRadius: 10, opacity: submitting ? 0.6 : 1 })}
                    >
                      <Txt size={13.5} weight="600" color={accent}>{submitting ? tr('saving…') : tr('publish job')}</Txt>
                    </Pressable>
                    <Pressable
                      onPress={submitting ? undefined : () => void submit(false)}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: submitting }}
                      style={(s) => ({ borderWidth: 1, borderColor: (s as { hovered?: boolean }).hovered && !submitting ? t.ink : t.l15, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18, backgroundColor: t.card, opacity: submitting ? 0.6 : 1 })}
                    >
                      <Txt size={13.5} weight="600">{tr('save draft')}</Txt>
                    </Pressable>
                  </>
                )}
                <Txt size={12.5} color={t.mut} style={{ flexShrink: 1 }}>
                  {wasPublished
                    ? tr('this job is published — the publish date can no longer change.')
                    : tr('a draft is saved but hidden from seekers until you publish it.')}
                </Txt>
              </View>

              {existing ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
                  <Pressable
                    onPress={() => setConfirmDelete(true)}
                    accessibilityRole="button"
                    style={(s) => ({ borderWidth: 1, borderColor: (s as { hovered?: boolean }).hovered ? '#dc2626' : t.l15, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: t.card })}
                  >
                    <Txt size={12.5} weight="600" color="#dc2626">{tr('delete job')}</Txt>
                  </Pressable>
                  <Txt size={12} color={t.mut}>{tr('deleting removes the job and its applications for good.')}</Txt>
                </View>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      <Overlay visible={confirmDelete} onClose={deleting ? () => undefined : () => setConfirmDelete(false)} width={420} radius={18} padding={0}>
        <View style={{ paddingVertical: 24, paddingHorizontal: 26, gap: 14 }}>
          <Txt size={17} weight="700" ls={-0.02}>{`${tr('delete')} ${existing?.title ?? ''}?`}</Txt>
          <Txt size={12.5} color={t.mut} lh={1.5}>{tr('this cannot be undone. the job disappears from search and every application on it is removed.')}</Txt>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
            <Pressable onPress={deleting ? undefined : () => setConfirmDelete(false)} accessibilityRole="button" style={{ borderWidth: 1, borderColor: t.l15, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 }}>
              <Txt size={12.5} weight="600">{tr('cancel')}</Txt>
            </Pressable>
            <Pressable onPress={deleting ? undefined : () => void remove()} accessibilityRole="button" accessibilityState={{ disabled: deleting }} style={{ backgroundColor: '#b91c1c', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 13, opacity: deleting ? 0.6 : 1 }}>
              <Txt size={12.5} weight="600" color="#F6F4EE">{deleting ? tr('deleting…') : tr('delete job')}</Txt>
            </Pressable>
          </View>
        </View>
      </Overlay>
      <Toast msg={toast.msg} />
    </View>
  );
}
