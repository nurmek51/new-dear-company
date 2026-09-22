import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { resumeApi, type ResumeUploadResult } from '@/entities/resume';
import { type AsyncTaskTicket } from '@/shared/api';
import { useT } from '@/shared/lib/useT';
import { accent, useTheme } from '@/shared/theme';
import { Btn, Card, Checkbox, Txt } from '@/shared/ui';
import { documentForm, pickDocument, validateDocument, type PickedDoc } from '../lib/documentFile';
import { useAsyncTask } from '../lib/useAsyncTask';
import { TaskModal } from './TaskModal';

interface Props {
  onUploaded: () => void;
}

/** Design card 1 ("already have one? drop it") wired to POST /resumes/ + the parsing SSE channel. */
export function UploadCard({ onUploaded }: Props) {
  const t = useTheme();
  const tr = useT();
  const task = useAsyncTask();
  const [parse, setParse] = useState(true);
  const [doc, setDoc] = useState<PickedDoc | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<ResumeUploadResult | null>(null);

  const startUpload = (d: PickedDoc) => {
    setDoc(d);
    setUploaded(null);
    void task.run(async (): Promise<AsyncTaskTicket | { immediate: unknown }> => {
      const res = await resumeApi.uploadResume(documentForm('file', d), parse);
      setUploaded(res);
      onUploaded();
      if (res.task_id && res.event_url) {
        return { task_id: res.task_id, event_id: res.event_id ?? '', event_url: res.event_url };
      }
      return { immediate: res };
    });
  };

  const busy = task.state.status === 'starting' || task.state.status === 'waiting';

  const pick = async () => {
    if (busy) return;
    setPickError(null);
    const d = await pickDocument();
    if (!d) return;
    const invalid = validateDocument(d);
    if (invalid) {
      setPickError(invalid);
      return;
    }
    startUpload(d);
  };

  const close = () => {
    task.cancel();
    setDoc(null);
  };

  const parsed = uploaded?.task_id != null;
  const title =
    task.state.status === 'done'
      ? parsed
        ? tr('we read your cv')
        : tr('cv uploaded')
      : task.state.status === 'error'
        ? tr("that didn't work")
        : parsed
          ? tr('reading your cv')
          : tr('uploading your cv');

  return (
    <Card radius={24} padding={30} gap={14} style={{ flex: 1, alignItems: 'center' }}>
      <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: t.oc2bg, alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
        <Txt size={26} weight="700" color={t.oc2}>↑</Txt>
      </View>
      <Txt size={19} weight="700" ls={-0.02} align="center">{tr('already have one? drop it')}</Txt>
      <Txt size={13.5} color={t.mut} lh={1.55} align="center">
        {tr('.pdf, .doc, .docx or .txt, up to 5 mb. we read it once to fill in your profile — zero retyping.')}
      </Txt>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: parse }} onPress={() => setParse((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Checkbox checked={parse} onPress={() => setParse((v) => !v)} variant="accent" />
        <Txt size={12.5} color={t.ink2} style={{ flexShrink: 1 }}>{tr('update my profile from this file')}</Txt>
      </Pressable>
      {parse && (
        <Txt size={11.5} color={t.mut2} lh={1.5} align="center">
          {tr('this overwrites your profile bio, skills, experience, education, languages and certifications with what the file says.')}
        </Txt>
      )}
      {pickError && <Txt size={12.5} color="#b91c1c" align="center">{pickError}</Txt>}
      <Btn label={busy ? tr('uploading…') : tr('upload cv')} size={13.5} px={26} py={11} disabled={busy} onPress={() => void pick()} style={{ marginTop: 'auto', opacity: busy ? 0.6 : 1 }} />

      <TaskModal
        visible={doc != null}
        title={title}
        subject={doc?.name ?? ''}
        state={task.state}
        onClose={close}
        onCancel={close}
        onRetry={doc ? () => startUpload(doc) : undefined}
        onRefresh={() => {
          onUploaded();
          close();
        }}
        footnote={tr('your cv is never shown to companies without you pressing apply. delete it anytime from the list.')}
      >
        <View style={{ flexDirection: 'column', gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: t.bg, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 18 }}>
            <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
              <Txt size={19} weight="700" color="#141519">✓</Txt>
            </View>
            <View style={{ flex: 1, flexDirection: 'column', gap: 3 }}>
              <Txt size={14.5} weight="700">{parsed ? tr('done — your profile was updated from it') : tr('saved to your resumes')}</Txt>
              <Txt size={12.5} color={t.mut} lh={1.5}>
                {parsed ? tr('have a look at your profile and fix anything the reader got wrong.') : (uploaded?.message ?? tr('it was stored without parsing.'))}
              </Txt>
            </View>
          </View>
          <Btn label={tr('close')} variant="accent" size={13} px={20} py={11} radius={11} onPress={close} style={{ alignSelf: 'flex-start' }} />
        </View>
      </TaskModal>
    </Card>
  );
}
