import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { JobSearchItem } from '@/entities/job';
import { resumeApi, resumeTitle, summarizeResult, type Resume } from '@/entities/resume';
import { humanize, type AsyncTaskTicket } from '@/shared/api';
import { useT } from '@/shared/lib/useT';
import { accent, useTheme } from '@/shared/theme';
import { Btn, Card, Txt } from '@/shared/ui';
import { apiMessage } from '../lib/usePagedList';
import { useAsyncTask } from '../lib/useAsyncTask';
import { DocRow, fmtDate } from './DocRow';
import { JobPickerModal } from './JobPickerModal';
import { ListState } from './ListState';
import { ResultBlocks } from './ResultBlocks';
import { TaskModal } from './TaskModal';

type Kind = 'check' | 'tailor' | 'fit';

interface Props {
  rows: Resume[];
  count: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  nextPage: number | null;
  reload: () => Promise<void>;
  loadMore: () => Promise<void>;
  setRows: (fn: (rows: Resume[]) => Resume[]) => void;
}

/** "your resumes" — replaces the design's "build it together" card (no profile-write endpoints). */
export function ResumesCard({ rows, count, loading, loadingMore, error, nextPage, reload, loadMore, setRows }: Props) {
  const t = useTheme();
  const tr = useT();
  const task = useAsyncTask();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ kind: Exclude<Kind, 'check'>; resume: Resume } | null>(null);
  const [modal, setModal] = useState<{ kind: Kind; resume: Resume; job?: JobSearchItem } | null>(null);

  useEffect(() => {
    let alive = true;
    resumeApi
      .getSelectedDocs()
      .then((d) => alive && setSelectedId(d.resume?.id ?? null))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [rows.length]);

  const select = async (r: Resume) => {
    setBusyId(r.id);
    setRowError(null);
    try {
      await resumeApi.setResumeSelected(r.id);
      setSelectedId(r.id);
    } catch (err) {
      setRowError(apiMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (r: Resume) => {
    setRowError(null);
    try {
      await resumeApi.deleteResume(r.id);
      setRows((rs) => rs.filter((x) => x.id !== r.id));
    } catch (err) {
      setRowError(apiMessage(err));
    }
  };

  const start = useCallback(
    (kind: Kind, resume: Resume, job?: JobSearchItem) => {
      setModal({ kind, resume, job });
      void task.run(async (): Promise<AsyncTaskTicket | { immediate: unknown }> => {
        if (kind === 'check') return resumeApi.assessResume({ resume_id: resume.id });
        if (kind === 'tailor') return resumeApi.aiGenerateResume(job!.id);
        const res = await resumeApi.recommendations(job!.id, resume.id);
        return res.cached ? { immediate: res.recommendations } : res;
      });
    },
    [task],
  );

  useEffect(() => {
    if (task.state.status === 'done' && modal?.kind === 'tailor') void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.state.status]);

  const closeModal = () => {
    task.cancel();
    setModal(null);
  };

  const modalTitle = (() => {
    if (!modal) return '';
    const s = task.state.status;
    if (s === 'error') return tr("that didn't work");
    if (modal.kind === 'check') return s === 'done' ? tr("here's what we saw") : tr('checking your cv');
    if (modal.kind === 'tailor') return s === 'done' ? tr('your tailored cv is ready') : tr('writing a tailored cv');
    return s === 'done' ? tr('how you fit this job') : tr('comparing your cv with the job');
  })();

  const summary = task.state.status === 'done' ? summarizeResult(task.state.result) : null;

  return (
    <Card radius={24} padding={30} gap={14} style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Txt size={19} weight="700" ls={-0.02} style={{ flex: 1 }}>{tr('your resumes')}</Txt>
        {count > 0 && <Txt size={12.5} color={t.mut} mono>{String(count)}</Txt>}
      </View>
      <Txt size={13.5} color={t.mut} lh={1.55}>
        {tr('the selected one goes with your applications. check it, or let the ai tailor a copy for a specific job.')}
      </Txt>
      <ListState
        loading={loading}
        error={error}
        empty={rows.length === 0}
        emptyText={tr('no resumes yet — upload one on the left to get started.')}
        onRetry={() => void reload()}
      />
      {rowError && <Txt size={12.5} color="#b91c1c">{rowError}</Txt>}
      {rows.map((r) => (
        <DocRow
          key={r.id}
          title={resumeTitle(r)}
          meta={[
            fmtDate(r.created_at),
            r.parsing_status ? `${tr('parsing')}: ${humanize(String(r.parsing_status))}` : '',
            r.is_ai_generated ? tr('ai-generated') : '',
          ]}
          selected={selectedId === r.id}
          busy={busyId === r.id}
          actions={[
            ...(selectedId === r.id ? [] : [{ label: tr('use this one'), onPress: () => void select(r) }]),
            { label: tr('check it'), onPress: () => start('check', r), accent: true },
            { label: tr('fit for a job'), onPress: () => setPicker({ kind: 'fit', resume: r }) },
            { label: tr('tailor for a job'), onPress: () => setPicker({ kind: 'tailor', resume: r }) },
          ]}
          onDelete={() => remove(r)}
        />
      ))}
      {nextPage != null && !loading && (
        loadingMore ? (
          <ActivityIndicator color={t.mut} />
        ) : (
          <Btn label={tr('load more')} variant="muted" size={13} px={16} py={9} onPress={() => void loadMore()} style={{ alignSelf: 'flex-start' }} />
        )
      )}

      <JobPickerModal
        visible={picker != null}
        title={picker?.kind === 'tailor' ? tr('tailor for which job?') : tr('compare with which job?')}
        onClose={() => setPicker(null)}
        onPick={(job) => {
          if (!picker) return;
          const { kind, resume } = picker;
          setPicker(null);
          start(kind, resume, job);
        }}
      />

      <TaskModal
        visible={modal != null}
        title={modalTitle}
        subject={modal ? (modal.job ? `${resumeTitle(modal.resume)} → ${modal.job.designation}` : resumeTitle(modal.resume)) : ''}
        state={task.state}
        onClose={closeModal}
        onCancel={closeModal}
        onRetry={modal ? () => start(modal.kind, modal.resume, modal.job) : undefined}
        onRefresh={() => {
          void reload();
          closeModal();
        }}
        footnote={
          modal?.kind === 'tailor'
            ? tr('the tailored copy is saved as a new resume in this list.')
            : tr('the ai reads patterns, not people — it can be wrong. nothing here is sent to companies.')
        }
      >
        {summary && modal?.kind === 'tailor' ? (
          <View style={{ flexDirection: 'column', gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: t.bg, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 18 }}>
              <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
                <Txt size={19} weight="700" color="#141519">✓</Txt>
              </View>
              <View style={{ flex: 1, flexDirection: 'column', gap: 3 }}>
                <Txt size={14.5} weight="700">{tr('done — it is in your list now')}</Txt>
                <Txt size={12.5} color={t.mut} lh={1.5}>{tr('review it before you use it: ai text can invent details.')}</Txt>
              </View>
            </View>
            <Btn label={tr('close')} variant="accent" size={13} px={20} py={11} radius={11} onPress={closeModal} style={{ alignSelf: 'flex-start' }} />
          </View>
        ) : summary ? (
          <View style={{ flexDirection: 'column', gap: 16 }}>
            {(summary.score != null || summary.headline) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: t.bg, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 18 }}>
                {summary.score != null && (
                  <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
                    <Txt size={19} weight="700" color="#141519">{String(summary.score)}</Txt>
                  </View>
                )}
                <View style={{ flex: 1, flexDirection: 'column', gap: 3 }}>
                  <Txt size={14.5} weight="700">{summary.headline ?? tr('here is the verdict')}</Txt>
                  {modal?.job && <Txt size={12.5} color={t.mut} lh={1.5}>{`${modal.job.designation} · ${modal.job.company}`}</Txt>}
                </View>
              </View>
            )}
            {summary.blocks.length > 0 ? (
              <View style={{ maxHeight: 260 }}>
                <ResultBlocks blocks={summary.blocks} />
              </View>
            ) : (
              <Txt size={12.5} color={t.mut}>{tr('the result came back empty.')}</Txt>
            )}
            <Btn label={tr('close')} variant="accent" size={13} px={20} py={11} radius={11} onPress={closeModal} style={{ alignSelf: 'flex-start' }} />
          </View>
        ) : null}
      </TaskModal>
    </Card>
  );
}
