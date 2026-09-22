import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useT } from '@/shared/lib/useT';
import { useTheme } from '@/shared/theme';
import { Btn, Overlay, Txt } from '@/shared/ui';
import type { TaskState } from '../lib/useAsyncTask';
import { ProgressBar } from './ProgressBar';

interface Props {
  visible: boolean;
  title: string;
  /** what the bar is labeled with (file name / job title) */
  subject: string;
  state: TaskState;
  onClose: () => void;
  onCancel: () => void;
  onRetry?: () => void;
  /** "refresh list" fallback shown when the stream is lost */
  onRefresh?: () => void;
  /** rendered in the done state */
  children?: ReactNode;
  footnote?: string;
}

function useElapsed(startedAt: number | null, active: boolean): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
}

/** The design's roast modal (seeker.html 249–324), driven by a real async task. */
export function TaskModal({ visible, title, subject, state, onClose, onCancel, onRetry, onRefresh, children, footnote }: Props) {
  const t = useTheme();
  const tr = useT();
  const busy = state.status === 'starting' || state.status === 'waiting';
  const elapsed = useElapsed(state.startedAt, busy);
  const outline = { borderWidth: 1.5, borderColor: t.chip, paddingVertical: 11, paddingHorizontal: 18, borderRadius: 11 } as const;
  return (
    <Overlay visible={visible} onClose={busy ? () => undefined : onClose} width={560} padding={26} radius={22}>
      <View style={{ flexDirection: 'column', gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Txt size={17} weight="700" ls={-0.02} style={{ flex: 1 }}>{title}</Txt>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr('close')}
            onPress={busy ? onCancel : onClose}
            style={{ width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}
          >
            <Txt size={14} color={t.mut}>✕</Txt>
          </Pressable>
        </View>

        {busy && (
          <View style={{ flexDirection: 'column', gap: 12, paddingVertical: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Txt size={22}>🐈‍⬛</Txt>
              <View style={{ flex: 1, minWidth: 0, flexDirection: 'column', gap: 5 }}>
                <Txt size={13.5} weight="700" numberOfLines={1}>{subject}</Txt>
                <ProgressBar />
              </View>
            </View>
            <Txt size={12.5} color={t.mut}>
              {state.status === 'starting'
                ? tr('sending…')
                : `${state.message ?? tr('waiting for the result…')}${elapsed > 0 ? ` · ${elapsed}s` : ''}`}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Pressable accessibilityRole="button" onPress={onCancel} style={outline}>
                <Txt size={13} weight="600" color={t.mut}>{tr('cancel')}</Txt>
              </Pressable>
            </View>
          </View>
        )}

        {state.status === 'error' && (
          <>
            <View style={{ backgroundColor: '#FDE2E2', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 18, flexDirection: 'column', gap: 6 }}>
              <Txt size={14} weight="700" color="#b91c1c">{tr("that didn't work")}</Txt>
              <Txt size={12.5} color="#7f1d1d" lh={1.55}>{state.error ?? tr('something went wrong')}</Txt>
              {state.streamLost && (
                <Txt size={12.5} color="#7f1d1d" lh={1.55}>
                  {tr('the task may still finish on the server — refresh the list in a minute to check.')}
                </Txt>
              )}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {onRetry && <Btn label={tr('try again')} size={13} px={20} py={11} radius={11} onPress={onRetry} />}
              {onRefresh && (
                <Pressable accessibilityRole="button" onPress={onRefresh} style={outline}>
                  <Txt size={13} weight="600">{tr('refresh list')}</Txt>
                </Pressable>
              )}
              <Pressable accessibilityRole="button" onPress={onClose} style={outline}>
                <Txt size={13} weight="600">{tr('close')}</Txt>
              </Pressable>
            </View>
          </>
        )}

        {state.status === 'done' && children}

        {footnote ? <Txt size={11.5} color={t.mut2} lh={1.5}>{footnote}</Txt> : null}
      </View>
    </Overlay>
  );
}
