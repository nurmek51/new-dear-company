import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import {
  PIPELINE_STAGES,
  applicantsApi,
  isRecruiterStatus,
  stageOf,
  type Applicant,
  type B2BTrackingRow,
} from '@/entities/applicant';
import { candidatePoolApi, type CandidateProfile } from '@/entities/candidate-pool';
import { ApiError, humanize } from '@/shared/api';
import { useBreakpoint } from '@/shared/lib/responsive';
import { useT } from '@/shared/lib/useT';
import { accent, link, useTheme } from '@/shared/theme';
import { Field, Txt } from '@/shared/ui';
import { Avatar, DarkBtn, OutlineBtn, SectionLabel, StatusPill, fmtDate, fmtDateTime } from './pipelineUi';

function TagChip({ label }: { label: string }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.chip, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10 }}>
      <Txt size={11} weight="600" color={t.ink3}>{label}</Txt>
    </View>
  );
}

function ExternalLink({ label, url }: { label: string; url: string }) {
  return (
    <Pressable onPress={() => Linking.openURL(url)} accessibilityRole="link">
      <Txt size={12.5} weight="600" color={link}>{`${label} ↗`}</Txt>
    </Pressable>
  );
}

/** Public profile block (GET candidate-profile-by-profile-id). Shared by the detail panel and the pool matches. */
export function ProfileBody({ profile }: { profile: CandidateProfile }) {
  const t = useTheme();
  const tr = useT();
  const salary =
    profile.expected_salary_min != null || profile.expected_salary_max != null
      ? `${profile.expected_salary_min ?? '…'} – ${profile.expected_salary_max ?? '…'} ${profile.salary_currency ?? ''}`.trim()
      : null;
  return (
    <View style={{ gap: 10 }}>
      {profile.heading ? <Txt size={13} weight="600">{profile.heading}</Txt> : null}
      <Txt size={12.5} color={t.mut} lh={1.5}>
        {[
          profile.department,
          profile.address,
          profile.years_of_experience != null ? `${profile.years_of_experience} ${tr('yrs')}` : null,
          profile.english_level ? `${tr('english')} ${profile.english_level}` : null,
          salary ? `${tr('expects')} ${salary}` : null,
        ]
          .filter(Boolean)
          .join(' · ') || tr('no details on the profile yet')}
      </Txt>
      {profile.bio ? <Txt size={12.5} color={t.ink2} lh={1.55}>{profile.bio}</Txt> : null}
      {profile.skills.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
          {profile.skills.map((s) => <TagChip key={s} label={s.toLowerCase()} />)}
        </View>
      ) : null}
      {profile.work_experiences.length ? (
        <View style={{ gap: 6 }}>
          <Txt size={11.5} weight="600" color={t.mut}>{tr('experience')}</Txt>
          {profile.work_experiences.slice(0, 5).map((e, i) => (
            <View key={`${e.title ?? ''}-${i}`}>
              <Txt size={12.5} weight="600">{[e.title, e.company].filter(Boolean).join(' · ') || tr('role')}</Txt>
              {e.start || e.end ? <Txt size={11.5} color={t.mut}>{`${fmtDate(e.start) || '…'} → ${fmtDate(e.end) || tr('now')}`}</Txt> : null}
            </View>
          ))}
        </View>
      ) : null}
      {profile.educations.length ? (
        <View style={{ gap: 4 }}>
          <Txt size={11.5} weight="600" color={t.mut}>{tr('education')}</Txt>
          {profile.educations.slice(0, 3).map((e, i) => (
            <Txt key={`${e.degree ?? ''}-${i}`} size={12.5}>{[e.degree, e.institution].filter(Boolean).join(' · ')}</Txt>
          ))}
        </View>
      ) : null}
      {profile.resume_docs.length || profile.cover_letter_docs.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {profile.resume_docs.filter((d) => d.file).map((d) => <ExternalLink key={d.id} label={d.title || tr('resume')} url={d.file as string} />)}
          {profile.cover_letter_docs.filter((d) => d.file).map((d) => <ExternalLink key={d.id} label={d.title || tr('cover letter')} url={d.file as string} />)}
        </View>
      ) : null}
      {profile.email || profile.phone ? (
        <Txt size={11.5} color={t.mut2}>{[profile.email, profile.phone].filter(Boolean).join(' · ')}</Txt>
      ) : null}
    </View>
  );
}

function StageTimeline({ status }: { status: string }) {
  const t = useTheme();
  const tr = useT();
  const stage = stageOf(status);
  const closed = stage === 'closed';
  const idx = closed ? -1 : PIPELINE_STAGES.indexOf(stage);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', rowGap: 6 }}>
      {PIPELINE_STAGES.map((st, i) => {
        const done = i < idx;
        const cur = i === idx;
        return (
          <View key={st} style={{ flexDirection: 'row', alignItems: 'center', flexGrow: i > 0 ? 1 : 0 }}>
            {i > 0 ? <View style={{ flex: 1, minWidth: 10, height: 2, backgroundColor: i <= idx ? accent : '#e4e4e7', marginHorizontal: 6 }} /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {done ? (
                <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
                  <Txt size={9} color="#141519">✓</Txt>
                </View>
              ) : cur ? (
                <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#141519', alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: accent }} />
                </View>
              ) : (
                <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#d4d4d8' }} />
              )}
              <Txt size={11.5} weight={cur ? '700' : done ? '600' : '400'} color={done ? '#16a34a' : cur ? t.ink : t.mut2}>
                {cur ? `${tr(st)} · ${humanize(status)}` : tr(st)}
              </Txt>
            </View>
          </View>
        );
      })}
      {closed ? (
        <View style={{ marginLeft: 10 }}>
          <StatusPill status={status} />
        </View>
      ) : null}
    </View>
  );
}

export function CandidateDetail({
  applicant,
  onMove,
  onReject,
  onNoteAdded,
  refreshKey,
}: {
  applicant: Applicant;
  onMove: () => void;
  onReject: () => void;
  onNoteAdded: (msg: string) => void;
  /** bump to reload the timeline after a status change */
  refreshKey: number;
}) {
  const t = useTheme();
  const tr = useT();
  const bp = useBreakpoint();
  const [profile, setProfile] = useState<CandidateProfile | null | undefined>(undefined);
  const [profileErr, setProfileErr] = useState<string | null>(null);
  const [tracking, setTracking] = useState<B2BTrackingRow[] | null>(null);
  const [trackErr, setTrackErr] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [posting, setPosting] = useState(false);
  const [noteErr, setNoteErr] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setProfile(undefined);
    setProfileErr(null);
    if (!applicant.profile_id) {
      setProfile(null);
      return;
    }
    try {
      setProfile(await candidatePoolApi.getCandidateProfile(applicant.profile_id));
    } catch (e) {
      setProfileErr(e instanceof ApiError ? e.message : tr('could not load the profile'));
    }
  }, [applicant.profile_id, tr]);

  const loadTracking = useCallback(async () => {
    setTrackErr(null);
    try {
      setTracking(await applicantsApi.getTracking(applicant.id));
    } catch (e) {
      setTrackErr(e instanceof ApiError ? e.message : tr('could not load the timeline'));
    }
  }, [applicant.id, tr]);

  useEffect(() => {
    let cancelled = false;
    setNote('');
    setNoteErr(null);
    (async () => {
      if (cancelled) return;
      await loadProfile();
    })();
    return () => { cancelled = true; };
  }, [loadProfile]);

  useEffect(() => {
    let cancelled = false;
    setTracking(null);
    (async () => {
      if (cancelled) return;
      await loadTracking();
    })();
    return () => { cancelled = true; };
  }, [loadTracking, refreshKey]);

  const canNote = isRecruiterStatus(applicant.status);
  const postNote = async () => {
    const text = note.trim();
    if (!text || posting || !isRecruiterStatus(applicant.status)) return;
    setPosting(true);
    setNoteErr(null);
    try {
      await applicantsApi.updateStatus(applicant.id, { status: applicant.status, notes: text, action: 'note' });
      setNote('');
      await loadTracking();
      onNoteAdded(tr('note added to the timeline'));
    } catch (e) {
      setNoteErr(e instanceof ApiError ? e.message : tr('could not save the note'));
    } finally {
      setPosting(false);
    }
  };

  const m = applicant.match_score_obj;
  const score = applicant.match_score ?? m?.score ?? m?.overall_match_percent ?? null;
  const notes = (tracking ?? []).filter((r) => r.notes && r.notes.trim());
  const closed = stageOf(applicant.status) === 'closed';
  const px = bp.isMobile ? 16 : 28;

  return (
    <View>
      <View style={{ gap: 14, paddingTop: 24, paddingHorizontal: px }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16, rowGap: 12, flexWrap: 'wrap' }}>
          <Avatar name={applicant.name} uri={applicant.profile_picture} size={52} radius={16} fontSize={18} />
          <View style={{ flex: 1, minWidth: 200, gap: 9, paddingTop: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Txt size={21} weight="700" ls={-0.02}>{applicant.name || tr('candidate')}</Txt>
              <StatusPill status={applicant.status} />
              {score != null ? (
                <View style={{ backgroundColor: t.chip, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 9 }}>
                  <Txt size={11} weight="700" mono>{`${Math.round(score)}% ${tr('match')}`}</Txt>
                </View>
              ) : null}
            </View>
            <Txt size={12.5} color={t.mut} style={{ marginTop: -6 }}>
              {[applicant.email, applicant.applied_at ? `${tr('applied')} ${fmtDate(applicant.applied_at)}` : null, applicant.current_job_status ? humanize(applicant.current_job_status) : null]
                .filter(Boolean)
                .join(' · ')}
            </Txt>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {!closed ? <OutlineBtn label={tr('reject')} danger onPress={onReject} /> : null}
            <DarkBtn label={closed ? tr('restore ↩') : tr('move to ▾')} onPress={onMove} />
          </View>
        </View>
      </View>

      <View style={{ marginTop: 20, marginHorizontal: px }}>
        <StageTimeline status={applicant.status} />
      </View>

      <View style={{ flexDirection: bp.isMobile ? 'column' : 'row', gap: 14, marginTop: 22, marginHorizontal: px }}>
        <View style={{ flex: 1, borderWidth: 1, borderColor: t.l10, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 18, gap: 12 }}>
          <SectionLabel>{tr('profile')}</SectionLabel>
          {profile === undefined && !profileErr ? (
            <ActivityIndicator color={t.mut} />
          ) : profileErr ? (
            <View style={{ gap: 8, alignItems: 'flex-start' }}>
              <Txt size={12.5} color={t.mut}>{profileErr}</Txt>
              <OutlineBtn label={tr('retry')} onPress={loadProfile} />
            </View>
          ) : profile ? (
            <ProfileBody profile={profile} />
          ) : (
            <Txt size={12.5} color={t.mut2}>{tr('no public profile for this candidate')}</Txt>
          )}
        </View>

        <View style={{ flex: 1, borderWidth: 1, borderColor: t.l10, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <SectionLabel>{tr('notes')}</SectionLabel>
            {notes.length ? (
              <View style={{ backgroundColor: t.chip, borderRadius: 99, paddingVertical: 2, paddingHorizontal: 8 }}>
                <Txt size={10.5} weight="700" mono color={t.ink2}>{String(notes.length)}</Txt>
              </View>
            ) : null}
          </View>
          <View style={{ gap: 12, marginTop: 12, maxHeight: 220, overflow: 'hidden' }}>
            {tracking === null && !trackErr ? (
              <ActivityIndicator color={t.mut} />
            ) : (
              notes.slice(0, 6).map((r) => (
                <View key={r.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                  <Avatar name={r.actor_name ?? tr('team')} size={26} fontSize={10} />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <Txt size={12} weight="700">{r.actor_name ?? tr('team')}</Txt>
                      <Txt size={10.5} mono color={t.mut2}>{fmtDateTime(r.created_at)}</Txt>
                      <Txt size={10.5} color={t.mut2}>{humanize(String(r.status))}</Txt>
                    </View>
                    <Txt size={12.5} lh={1.55} color={t.ink2}>{r.notes}</Txt>
                  </View>
                </View>
              ))
            )}
          </View>
          {tracking && notes.length === 0 ? (
            <Txt size={12.5} color={t.mut2} style={{ marginTop: 9 }}>{tr('no notes yet — write the first one')}</Txt>
          ) : null}
          <View style={{ marginTop: 'auto', paddingTop: 12, gap: 6 }}>
            <Txt size={11.5} weight="600" color={t.mut}>{tr('add a note (recorded in the timeline)')}</Txt>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Field
                value={note}
                onChangeText={setNote}
                placeholder={canNote ? tr('write a note…') : tr('notes are closed for withdrawn applications')}
                size={12.5}
                radius={8}
                bg={t.card}
                borderColor={t.l13}
                onSubmitEditing={postNote}
                style={{ flex: 1, minWidth: 0, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1 }}
              />
              <Pressable
                onPress={postNote}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canNote || posting || !note.trim() }}
                style={{ backgroundColor: '#141519', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, justifyContent: 'center', opacity: !canNote || posting || !note.trim() ? 0.5 : 1 }}
              >
                <Txt size={12.5} weight="600" color="#F6F4EE">{posting ? '…' : tr('post')}</Txt>
              </Pressable>
            </View>
            {noteErr ? <Txt size={11.5} color="#b91c1c">{noteErr}</Txt> : null}
          </View>
        </View>
      </View>

      {m && (m.top_strengths?.length || m.top_gaps?.length || m.skill_matches?.length || m.skill_gaps?.length || m.blocked) ? (
        <View style={{ marginTop: 14, marginHorizontal: px, borderWidth: 1, borderColor: t.l10, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 18, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <SectionLabel>{tr('match breakdown')}</SectionLabel>
            {score != null ? <Txt size={11} weight="700" mono>{`${Math.round(score)}%`}</Txt> : null}
          </View>
          {m.blocked ? <Txt size={12.5} color="#b91c1c">{`${tr('blocked')}: ${(m.block_reasons ?? []).join(', ') || tr('hard requirement not met')}`}</Txt> : null}
          <View style={{ flexDirection: bp.isMobile ? 'column' : 'row', gap: 14 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Txt size={11.5} weight="600" color="#16a34a">{tr('strengths')}</Txt>
              {(m.top_strengths ?? []).map((s, i) => (
                <Txt key={`s-${i}`} size={12.5} color={t.ink2} lh={1.5}><Txt size={12.5} weight="600">{humanize(s.criterion)}</Txt>{s.why ? ` — ${s.why}` : ''}</Txt>
              ))}
              {m.skill_matches?.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                  {m.skill_matches.map((s) => <TagChip key={s} label={s.toLowerCase()} />)}
                </View>
              ) : null}
              {!m.top_strengths?.length && !m.skill_matches?.length ? <Txt size={12.5} color={t.mut2}>{tr('none listed')}</Txt> : null}
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Txt size={11.5} weight="600" color="#b45309">{tr('gaps')}</Txt>
              {(m.top_gaps ?? []).map((s, i) => (
                <Txt key={`g-${i}`} size={12.5} color={t.ink2} lh={1.5}><Txt size={12.5} weight="600">{humanize(s.criterion)}</Txt>{s.why ? ` — ${s.why}` : ''}</Txt>
              ))}
              {m.skill_gaps?.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                  {m.skill_gaps.map((s) => <TagChip key={s} label={s.toLowerCase()} />)}
                </View>
              ) : null}
              {!m.top_gaps?.length && !m.skill_gaps?.length ? <Txt size={12.5} color={t.mut2}>{tr('none listed')}</Txt> : null}
            </View>
          </View>
        </View>
      ) : null}

      <View style={{ marginTop: 22, marginHorizontal: px, marginBottom: 26, borderTopWidth: 1, borderTopColor: t.l08, paddingTop: 14 }}>
        <SectionLabel>{tr('activity')}</SectionLabel>
        <View style={{ gap: 8, marginTop: 10 }}>
          {tracking === null && !trackErr ? (
            <ActivityIndicator color={t.mut} />
          ) : trackErr ? (
            <View style={{ gap: 8, alignItems: 'flex-start' }}>
              <Txt size={12.5} color={t.mut}>{trackErr}</Txt>
              <OutlineBtn label={tr('retry')} onPress={loadTracking} />
            </View>
          ) : tracking && tracking.length === 0 ? (
            <Txt size={12.5} color={t.mut2}>{tr('no activity recorded yet')}</Txt>
          ) : (
            (tracking ?? []).map((r) => (
              <View key={r.id} style={{ flexDirection: 'row', gap: 10 }}>
                <Txt size={11} mono color={t.mut2} style={{ width: 96 }}>{fmtDateTime(r.created_at)}</Txt>
                <Txt size={12.5} color={t.ink3} style={{ flex: 1 }}>
                  {`${humanize(String(r.status))}${r.action ? ` · ${humanize(r.action)}` : ''}${r.actor_name ? ` — ${r.actor_name}` : ''}${r.notes ? `: ${r.notes}` : ''}`}
                </Txt>
              </View>
            ))
          )}
        </View>
      </View>
    </View>
  );
}
