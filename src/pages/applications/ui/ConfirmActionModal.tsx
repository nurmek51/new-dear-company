import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { CandidateStatusUpdate, JobSeekerApplication } from '@/entities/application';
import { useT } from '@/shared/lib/useT';
import { danger, useTheme } from '@/shared/theme';
import { Btn, Field, Overlay, Txt } from '@/shared/ui';

export interface ConfirmActionModalProps {
  target: { row: JobSeekerApplication; status: CandidateStatusUpdate } | null;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (notes: string) => void;
}

/** Confirm-before-destructive sheet for withdraw / accept / decline (design modal pattern, 440px). */
export function ConfirmActionModal({ target, busy, error, onCancel, onConfirm }: ConfirmActionModalProps) {
  const t = useTheme();
  const tr = useT();
  const [notes, setNotes] = useState('');
  if (!target) return null;
  const { row, status } = target;
  const company = row.job.organization?.name ?? tr('the company');
  const copy: Record<CandidateStatusUpdate, { title: string; body: string; cta: string; destructive: boolean }> = {
    withdrawn: {
      title: tr('withdraw this application?'),
      body: `${tr('it comes off their pipeline right away. you can apply again later — but after two withdrawals from the same job the company stops accepting your application.')} (${row.withdrawn_count}/2 ${tr('so far')})`,
      cta: tr('yes, withdraw'),
      destructive: true,
    },
    'offer-accepted': {
      title: tr('accept the offer?'),
      body: `${tr('this tells')} ${company} ${tr("you're in. it's recorded in your application history.")}`,
      cta: tr('accept offer'),
      destructive: false,
    },
    'offer-rejected': {
      title: tr('decline the offer?'),
      body: `${tr('this tells')} ${company} ${tr("you're passing. you can leave a short note for them below.")}`,
      cta: tr('decline offer'),
      destructive: true,
    },
  };
  const c = copy[status];
  return (
    <Overlay visible onClose={busy ? () => undefined : onCancel} width={440} padding={26}>
      <View style={{ gap: 14 }}>
        <Txt size={20} weight="700" ls={-0.02}>
          {c.title}
        </Txt>
        <Txt size={13.5} color={t.mut} lh={1.55}>
          {c.body}
        </Txt>
        <Txt size={12} weight="600" color={t.ink2}>
          {row.job.title} · {company}
        </Txt>
        <Field value={notes} onChangeText={setNotes} placeholder={tr('a note for them (optional)')} multiline bg={t.bg} />
        {error && (
          <Txt size={13} color={danger}>
            {error}
          </Txt>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
          {busy ? <ActivityIndicator color={t.ink} /> : null}
          <Btn label={tr('keep it')} variant="muted" color={t.ink2} disabled={busy} onPress={onCancel} />
          <Btn
            label={c.cta}
            bg={c.destructive ? danger : '#141519'}
            color="#F6F4EE"
            disabled={busy}
            style={{ opacity: busy ? 0.6 : 1 }}
            onPress={() => onConfirm(notes.trim())}
          />
        </View>
      </View>
    </Overlay>
  );
}
