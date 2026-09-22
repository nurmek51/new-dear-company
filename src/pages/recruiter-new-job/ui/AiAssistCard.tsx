import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';
import { jobsApi } from '@/entities/job';
import { ApiError, subscribeEvents, type AsyncTaskTicket, type SseSubscription } from '@/shared/api';
import { useT } from '@/shared/lib/useT';
import { accent, link, useTheme } from '@/shared/theme';
import { Txt } from '@/shared/ui';
import { parseAiJobEvent, type JobForm } from '../model/jobForm';
import { Input } from './formUi';

type AiState = 'idle' | 'starting' | 'streaming' | 'done' | 'error';

const AI_TIMEOUT_MS = 120_000;
const FILE_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];

/**
 * "draft with ai" — POST ai-job-creation / ai-job-creation-from-file (spec §2.6)
 * → SSE on event_url → the parsed draft is written into the form for review.
 * Nothing is ever submitted automatically. Not in the prototype (its new-job
 * screen is manual); styled like its cards.
 */
export function AiAssistCard({ onDraft, disabled }: { onDraft: (draft: Partial<JobForm>) => void; disabled?: boolean }) {
  const t = useTheme();
  const tr = useT();
  const [prompt, setPrompt] = useState('');
  const [state, setState] = useState<AiState>('idle');
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastKind, setLastKind] = useState<'prompt' | 'file' | null>(null);
  const sub = useRef<SseSubscription | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    sub.current?.close();
    sub.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  const fail = useCallback((msg: string) => {
    stop();
    setError(msg);
    setState('error');
  }, [stop]);

  const run = useCallback(
    async (kind: 'prompt' | 'file', start: () => Promise<AsyncTaskTicket>) => {
      stop();
      setLastKind(kind);
      setError(null);
      setNote(null);
      setState('starting');
      let ticket: AsyncTaskTicket;
      try {
        ticket = await start();
      } catch (e) {
        fail(
          e instanceof ApiError
            ? e.isNetworkError
              ? tr('could not reach the server. check your connection and retry.')
              : e.message
            : tr('could not start the ai draft. check your connection and retry.'),
        );
        return;
      }
      setState('streaming');
      let gotDraft = false;
      const s = subscribeEvents(ticket.event_url, {
        onMessage: (msg) => {
          const ev = parseAiJobEvent(msg.data, msg.event);
          if (ev.kind === 'draft' && ev.draft) {
            gotDraft = true;
            onDraft(ev.draft);
            stop();
            setState('done');
          } else if (ev.kind === 'error') {
            fail(ev.message ?? tr('the ai draft failed'));
          } else if (ev.message) {
            setNote(ev.message);
          }
        },
        onError: () => {
          if (!gotDraft) fail(tr('the live connection dropped before the draft arrived.'));
        },
      });
      sub.current = s;
      if (s.unsupported) {
        fail(tr('live updates are not supported on this device.'));
        return;
      }
      timer.current = setTimeout(() => {
        if (!gotDraft) fail(tr('this is taking longer than expected.'));
      }, AI_TIMEOUT_MS);
    },
    [fail, onDraft, stop, tr],
  );

  const fromPrompt = () => {
    const p = prompt.trim();
    if (!p) return;
    void run('prompt', () => jobsApi.aiCreateJob(p));
  };

  const fromFile = async () => {
    let res: DocumentPicker.DocumentPickerResult;
    try {
      res = await DocumentPicker.getDocumentAsync({ type: FILE_TYPES, copyToCacheDirectory: true, multiple: false });
    } catch {
      fail(tr('could not open the file picker.'));
      return;
    }
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    const form = new FormData();
    if (Platform.OS === 'web' && a.file) form.append('file', a.file, a.name);
    else form.append('file', { uri: a.uri, name: a.name, type: a.mimeType ?? 'application/octet-stream' } as unknown as Blob);
    void run('file', () => jobsApi.aiCreateJobFromFile(form));
  };

  const busy = state === 'starting' || state === 'streaming';
  const canPrompt = !disabled && !busy && !!prompt.trim();

  return (
    <View style={{ backgroundColor: t.card, borderWidth: 1, borderColor: t.l10, borderRadius: 14, paddingVertical: 20, paddingHorizontal: 22, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#141519', alignItems: 'center', justifyContent: 'center' }}>
          <Txt size={11} weight="700" color={accent}>✦</Txt>
        </View>
        <Txt size={14} weight="700">{tr('draft with ai')}</Txt>
        <Txt size={12} color={t.mut}>{tr('optional · the draft lands in the form below for you to review')}</Txt>
      </View>

      <Input
        value={prompt}
        onChangeText={setPrompt}
        multiline
        minHeight={64}
        disabled={disabled || busy}
        label={tr('describe the role for the ai draft')}
        placeholder={tr('e.g. senior product designer, remote, b2b saas, 5+ years, owns discovery and design systems')}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Pressable
          onPress={canPrompt ? fromPrompt : undefined}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canPrompt }}
          style={{ backgroundColor: '#141519', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 13, opacity: canPrompt ? 1 : 0.5 }}
        >
          <Txt size={12.5} weight="600" color={accent}>{tr('draft from prompt')}</Txt>
        </Pressable>
        <Pressable
          onPress={disabled || busy ? undefined : () => void fromFile()}
          accessibilityRole="button"
          accessibilityState={{ disabled: disabled || busy }}
          style={{ borderWidth: 1, borderColor: t.l15, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: t.card, opacity: disabled || busy ? 0.5 : 1 }}
        >
          <Txt size={12.5} weight="600">{tr('from a file (.pdf, .doc, .docx, .txt)')}</Txt>
        </Pressable>
        {busy ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator size="small" color={t.mut} />
            <Txt size={12.5} color={t.mut}>{note ?? (state === 'starting' ? tr('sending…') : tr('drafting — this can take up to a minute'))}</Txt>
          </View>
        ) : null}
      </View>
      {state === 'done' ? (
        <Txt size={12.5} weight="600" color="#166534">{tr('draft loaded below — review every field before publishing.')}</Txt>
      ) : null}
      {state === 'error' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Txt size={12.5} color="#b91c1c">{error}</Txt>
          {lastKind === 'prompt' && prompt.trim() ? (
            <Pressable onPress={fromPrompt} accessibilityRole="button"><Txt size={12.5} weight="600" color={link}>{tr('retry')}</Txt></Pressable>
          ) : null}
          {lastKind === 'file' ? (
            <Pressable onPress={() => void fromFile()} accessibilityRole="button"><Txt size={12.5} weight="600" color={link}>{tr('pick the file again')}</Txt></Pressable>
          ) : null}
          <Pressable onPress={() => { setState('idle'); setError(null); }} accessibilityRole="button">
            <Txt size={12.5} weight="600" color={t.mut}>{tr("i'll fill it by hand")}</Txt>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
