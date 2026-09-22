import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { PIPELINE_STAGES, STATUSES_IN_STAGE, type RecruiterStatus } from '@/entities/applicant';
import { humanize } from '@/shared/api';
import { useT } from '@/shared/lib/useT';
import { accent, useTheme } from '@/shared/theme';
import { Field, Overlay, Txt } from '@/shared/ui';

const REJECT_REASONS = ['not enough experience', 'salary expectations', 'team fit', 'candidate withdrew', 'position filled', 'other'];

function ReasonChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        borderRadius: 999,
        paddingVertical: 7,
        paddingHorizontal: 14,
        backgroundColor: active ? '#141519' : t.card,
        borderWidth: 1,
        borderColor: active ? '#141519' : t.l12,
      }}
    >
      <Txt size={12.5} weight="600" color={active ? accent : t.ink}>{label}</Txt>
    </Pressable>
  );
}

/**
 * Reject modal (recruiter.html 1371–1390). KEEP: reason chips → POST
 * update-status {status:'rejected', notes}. HIDE: "reject & write email" (no
 * email endpoint). The copy is honest: notes land in the application's
 * tracking log, which the candidate can read (spec §4.1 b2c-tracking).
 */
export function RejectModal({
  name,
  visible,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  name: string;
  visible: boolean;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (notes: string) => void;
}) {
  const t = useTheme();
  const tr = useT();
  const [reason, setReason] = useState<string | null>(null);
  const [other, setOther] = useState('');
  useEffect(() => {
    if (visible) {
      setReason(null);
      setOther('');
    }
  }, [visible]);
  const notes = reason === 'other' ? other.trim() : reason ?? '';
  const can = !!notes && !busy;
  return (
    <Overlay visible={visible} onClose={busy ? () => undefined : onCancel} width={460} radius={18} padding={0}>
      <View style={{ paddingVertical: 24, paddingHorizontal: 26, gap: 14 }}>
        <View>
          <Txt size={17} weight="700" ls={-0.02}>{`${tr('reject')} ${name}?`}</Txt>
          <Txt size={12.5} color={t.mut} style={{ marginTop: 3 }}>
            {tr('a reason keeps your stats honest — it is saved to the application timeline, which the candidate can read.')}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {REJECT_REASONS.map((r) => (
            <ReasonChip key={r} label={tr(r)} active={reason === r} onPress={() => setReason(r)} />
          ))}
        </View>
        {reason === 'other' ? (
          <Field value={other} onChangeText={setOther} placeholder={tr('write the reason')} size={13} radius={9} bg={t.hov} />
        ) : null}
        {error ? <Txt size={12.5} color="#b91c1c">{error}</Txt> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 2, flexWrap: 'wrap' }}>
          <Pressable
            onPress={can ? () => onConfirm(notes) : undefined}
            accessibilityRole="button"
            accessibilityState={{ disabled: !can }}
            style={{ paddingVertical: 10, paddingHorizontal: 18, borderRadius: 9, backgroundColor: can ? '#141519' : t.chip }}
          >
            <Txt size={13} weight="600" color={can ? '#F6F4EE' : t.mut2}>{busy ? tr('rejecting…') : tr('reject')}</Txt>
          </Pressable>
          <Pressable onPress={busy ? undefined : onCancel} accessibilityRole="button" style={{ paddingVertical: 9, paddingHorizontal: 6 }}>
            <Txt size={13} weight="600" color={t.mut}>{tr('cancel')}</Txt>
          </Pressable>
        </View>
      </View>
    </Overlay>
  );
}

/**
 * "move to ▾" — replaces the design's drag-and-drop (no reorder endpoint;
 * status moves go through POST update-status). Lists every real
 * ApplicationStatus a recruiter may set (never `withdrawn`), grouped by the
 * board's stages, with an optional note.
 */
export function MoveModal({
  name,
  current,
  visible,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  name: string;
  current: string;
  visible: boolean;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (status: RecruiterStatus, notes: string) => void;
}) {
  const t = useTheme();
  const tr = useT();
  const [target, setTarget] = useState<RecruiterStatus | null>(null);
  const [notes, setNotes] = useState('');
  useEffect(() => {
    if (visible) {
      setTarget(null);
      setNotes('');
    }
  }, [visible]);
  const can = !!target && !busy;
  return (
    <Overlay visible={visible} onClose={busy ? () => undefined : onCancel} width={460} radius={18} padding={0}>
      <View style={{ paddingVertical: 24, paddingHorizontal: 26, gap: 14 }}>
        <View>
          <Txt size={17} weight="700" ls={-0.02}>{`${tr('move')} ${name}`}</Txt>
          <Txt size={12.5} color={t.mut} style={{ marginTop: 3 }}>
            {`${tr('currently')}: ${humanize(current)} · ${tr('the move is recorded in the application timeline')}`}
          </Txt>
        </View>
        {PIPELINE_STAGES.map((stage) => (
          <View key={stage} style={{ gap: 6 }}>
            <Txt size={11.5} weight="600" color={t.mut}>{tr(stage)}</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {STATUSES_IN_STAGE[stage]
                .filter((s): s is RecruiterStatus => s !== 'withdrawn' && s !== current)
                .map((s) => (
                  <ReasonChip key={s} label={humanize(s)} active={target === s} onPress={() => setTarget(s)} />
                ))}
            </View>
          </View>
        ))}
        <View style={{ gap: 6 }}>
          <Txt size={11.5} weight="600" color={t.mut}>{tr('note (optional)')}</Txt>
          <Field value={notes} onChangeText={setNotes} placeholder={tr('e.g. strong portfolio, schedule the tech round')} size={13} radius={9} bg={t.hov} />
        </View>
        {error ? <Txt size={12.5} color="#b91c1c">{error}</Txt> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 2 }}>
          <Pressable
            onPress={can && target ? () => onConfirm(target, notes.trim()) : undefined}
            accessibilityRole="button"
            accessibilityState={{ disabled: !can }}
            style={{ paddingVertical: 10, paddingHorizontal: 18, borderRadius: 9, backgroundColor: can ? '#141519' : t.chip }}
          >
            <Txt size={13} weight="600" color={can ? accent : t.mut2}>
              {busy ? tr('moving…') : target ? `${tr('move to')} ${humanize(target)} →` : tr('pick a status')}
            </Txt>
          </Pressable>
          <Pressable onPress={busy ? undefined : onCancel} accessibilityRole="button" style={{ paddingVertical: 9, paddingHorizontal: 6 }}>
            <Txt size={13} weight="600" color={t.mut}>{tr('cancel')}</Txt>
          </Pressable>
        </View>
      </View>
    </Overlay>
  );
}
