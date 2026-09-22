import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { coverLetterApi, type CoverLetter } from '@/entities/cover-letter';
import type { JobSearchItem } from '@/entities/job';
import { fileNameFromUrl } from '@/entities/resume';
import { useT } from '@/shared/lib/useT';
import { accent, useTheme } from '@/shared/theme';
import { Btn, Card, Txt } from '@/shared/ui';
import { documentForm, pickDocument, validateDocument } from '../lib/documentFile';
import { apiMessage, usePagedList } from '../lib/usePagedList';
import { useAsyncTask } from '../lib/useAsyncTask';
import { DocRow, fmtDate } from './DocRow';
import { JobPickerModal } from './JobPickerModal';
import { ListState } from './ListState';
import { TaskModal } from './TaskModal';

/** Cover letters (spec §3.7–3.8): list, upload, select, delete, generate for a job. */
export function CoverLettersCard() {
  const t = useTheme();
  const tr = useT();
  const fetchPage = useCallback((page: number) => coverLetterApi.listCoverLetters(page), []);
  const list = usePagedList<CoverLetter>(fetchPage);
  const task = useAsyncTask();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [job, setJob] = useState<JobSearchItem | null>(null);

  const upload = async () => {
    setUploadError(null);
    const doc = await pickDocument();
    if (!doc) return;
    const invalid = validateDocument(doc);
    if (invalid) {
      setUploadError(invalid);
      return;
    }
    setUploading(true);
    try {
      const title = doc.name.replace(/\.[^.]+$/, '');
      const created = await coverLetterApi.createCoverLetter(documentForm('file', doc), title);
      list.setRows((rs) => [created, ...rs.filter((x) => x.id !== created.id)]);
    } catch (err) {
      setUploadError(apiMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const select = async (c: CoverLetter) => {
    setBusyId(c.id);
    setRowError(null);
    try {
      await coverLetterApi.setCoverLetterSelected(c.id);
      list.setRows((rs) => rs.map((x) => ({ ...x, is_selected: x.id === c.id })));
    } catch (err) {
      setRowError(apiMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (c: CoverLetter) => {
    setRowError(null);
    try {
      await coverLetterApi.deleteCoverLetter(c.id);
      list.setRows((rs) => rs.filter((x) => x.id !== c.id));
    } catch (err) {
      setRowError(apiMessage(err));
    }
  };

  const generate = (j: JobSearchItem) => {
    setJob(j);
    void task.run(() => coverLetterApi.aiGenerateCoverLetter(j.id));
  };

  useEffect(() => {
    if (task.state.status === 'done') void list.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.state.status]);

  const closeModal = () => {
    task.cancel();
    setJob(null);
  };

  return (
    <Card radius={24} padding={30} gap={14}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Txt size={19} weight="700" ls={-0.02} style={{ flex: 1 }}>{tr('cover letters')}</Txt>
        {list.count > 0 && <Txt size={12.5} color={t.mut} mono>{String(list.count)}</Txt>}
      </View>
      <Txt size={13.5} color={t.mut} lh={1.55}>
        {tr('optional. the selected letter goes with your applications. upload one, or let the ai write one for a specific job.')}
      </Txt>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label={uploading ? tr('uploading…') : tr('upload a letter')} size={13.5} px={20} py={11} disabled={uploading} onPress={() => void upload()} />
        <Btn label={tr('write one for a job')} variant="accent" size={13.5} px={20} py={11} onPress={() => setPickerOpen(true)} />
      </View>
      <Txt size={11.5} color={t.mut2} lh={1.5}>{tr('.pdf, .doc, .docx or .txt, up to 5 mb.')}</Txt>
      {uploadError && <Txt size={12.5} color="#b91c1c">{uploadError}</Txt>}
      <ListState
        loading={list.loading}
        error={list.error}
        empty={list.rows.length === 0}
        emptyText={tr('no cover letters yet.')}
        onRetry={() => void list.reload()}
      />
      {rowError && <Txt size={12.5} color="#b91c1c">{rowError}</Txt>}
      {list.rows.map((c) => (
        <DocRow
          key={c.id}
          title={c.title?.trim() || fileNameFromUrl(c.file)}
          meta={[fmtDate(c.created_at), c.is_ai_generated ? tr('ai-generated') : '', c.job ? tr('written for a job') : '']}
          selected={c.is_selected}
          busy={busyId === c.id}
          actions={c.is_selected ? [] : [{ label: tr('use this one'), onPress: () => void select(c) }]}
          onDelete={() => remove(c)}
        />
      ))}
      {list.nextPage != null && !list.loading && (
        list.loadingMore ? (
          <ActivityIndicator color={t.mut} />
        ) : (
          <Btn label={tr('load more')} variant="muted" size={13} px={16} py={9} onPress={() => void list.loadMore()} style={{ alignSelf: 'flex-start' }} />
        )
      )}

      <JobPickerModal
        visible={pickerOpen}
        title={tr('a letter for which job?')}
        onClose={() => setPickerOpen(false)}
        onPick={(j) => {
          setPickerOpen(false);
          generate(j);
        }}
      />

      <TaskModal
        visible={job != null}
        title={task.state.status === 'done' ? tr('your cover letter is ready') : task.state.status === 'error' ? tr("that didn't work") : tr('writing your cover letter')}
        subject={job ? `${job.designation} · ${job.company}` : ''}
        state={task.state}
        onClose={closeModal}
        onCancel={closeModal}
        onRetry={job ? () => generate(job) : undefined}
        onRefresh={() => {
          void list.reload();
          closeModal();
        }}
        footnote={tr('the letter is saved in this list. read it before sending — ai text can invent details.')}
      >
        <View style={{ flexDirection: 'column', gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: t.bg, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 18 }}>
            <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
              <Txt size={19} weight="700" color="#141519">✓</Txt>
            </View>
            <View style={{ flex: 1, flexDirection: 'column', gap: 3 }}>
              <Txt size={14.5} weight="700">{tr('done — it is in your list now')}</Txt>
              {job && <Txt size={12.5} color={t.mut} lh={1.5}>{`${job.designation} · ${job.company}`}</Txt>}
            </View>
          </View>
          <Btn label={tr('close')} variant="accent" size={13} px={20} py={11} radius={11} onPress={closeModal} style={{ alignSelf: 'flex-start' }} />
        </View>
      </TaskModal>
    </Card>
  );
}
