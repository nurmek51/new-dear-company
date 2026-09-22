import { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { Job } from '@/entities/job';
import { useBreakpoint } from '@/shared/lib/responsive';
import { useT } from '@/shared/lib/useT';
import { accent, accentInk, danger, useTheme } from '@/shared/theme';
import { Txt } from '@/shared/ui';
import { daysUntil, locationText, logoTint, relativeDay, salaryText } from './shared';

interface Props {
  job: Job;
  savedAt?: string;
  removing: boolean;
  onApply: () => void;
  onRemove: () => void;
}

/** One saved-job row (design saved page, lines 1410–1466): logo · title+status · meta · apply/remove. */
export function SavedJobCard({ job, savedAt, removing, onApply, onRemove }: Props) {
  const t = useTheme();
  const tr = useT();
  const bp = useBreakpoint();
  const [confirm, setConfirm] = useState(false);

  const company = job.organization?.name ?? '';
  const tint = logoTint(t, company || job.title);
  const left = daysUntil(job.date_validthrough);
  const closed = left != null && left < 0;
  const closingSoon = left != null && left >= 0 && left <= 7;
  const meta = [company || null, locationText(job), salaryText(job), savedAt ? `${tr('saved')} ${relativeDay(savedAt)}` : null]
    .filter((x): x is string => !!x)
    .join(' · ');

  const status = closed
    ? { label: tr('closed'), bg: t.chip, color: t.mut, weight: '600' as const }
    : closingSoon
      ? { label: left === 0 ? tr('closes today') : `${tr('closes in')} ${left} ${tr(left === 1 ? 'day' : 'days')}`, bg: t.oc1bg, color: t.oc1, weight: '700' as const }
      : { label: tr('still open'), bg: accent, color: accentInk, weight: '700' as const };

  return (
    <View
      style={{
        flexDirection: bp.isMobile ? 'column' : 'row',
        alignItems: bp.isMobile ? 'stretch' : 'center',
        gap: 20,
        paddingVertical: 20,
        paddingHorizontal: 24,
        backgroundColor: closed ? t.card2 : t.card,
        borderRadius: 20,
        marginBottom: 10,
        shadowColor: '#141519',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: closed ? 0 : 0.04,
        shadowRadius: 2,
        opacity: removing ? 0.5 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 20, alignItems: 'center', flex: 1, minWidth: 0 }}>
        <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: tint.bg, alignItems: 'center', justifyContent: 'center', opacity: closed ? 0.7 : 1 }}>
          <Txt size={17} weight="700" color={tint.color}>{(company || job.title).slice(0, 1).toUpperCase()}</Txt>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Txt size={18} weight="700" ls={-0.02} color={closed ? t.ink2 : t.ink}>{job.title}</Txt>
            <View style={{ backgroundColor: status.bg, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999 }}>
              <Txt size={12} weight={status.weight} color={status.color}>{status.label}</Txt>
            </View>
          </View>
          {!!meta && <Txt size={13.5} color={t.mut}>{meta}</Txt>}
          {job.job_url && job.source !== 'internal' && (
            <Txt size={12.5} weight="600" color={t.ink2}>{tr('applies on the company site')}</Txt>
          )}
        </View>
      </View>
      <View style={{ gap: 5, alignItems: 'center', flexDirection: bp.isMobile ? 'row' : 'column', justifyContent: bp.isMobile ? 'space-between' : 'center' }}>
        {!closed && (
          <Pressable
            onPress={onApply}
            accessibilityRole="button"
            accessibilityLabel={`${tr('apply')} — ${job.title}`}
            style={(state) => ({ backgroundColor: (state as { hovered?: boolean }).hovered ? '#1781FB' : '#141519', paddingVertical: 10, paddingHorizontal: 22, borderRadius: 12 })}
          >
            <Txt size={13.5} weight="700" color="#F6F4EE">{tr('apply')}</Txt>
          </Pressable>
        )}
        {confirm ? (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Txt size={11} color={t.mut2}>{tr('remove?')}</Txt>
            <Pressable onPress={onRemove} disabled={removing} accessibilityRole="button" accessibilityLabel={tr('yes, remove')}>
              <Txt size={11} weight="700" color={danger}>{tr('yes')}</Txt>
            </Pressable>
            <Pressable onPress={() => setConfirm(false)} accessibilityRole="button" accessibilityLabel={tr('keep it')}>
              <Txt size={11} weight="700" color={t.mut}>{tr('no')}</Txt>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setConfirm(true)} disabled={removing} accessibilityRole="button" accessibilityLabel={`${tr('remove')} — ${job.title}`}>
            <Txt size={11} color={t.mut2}>{removing ? tr('removing…') : tr('remove')}</Txt>
          </Pressable>
        )}
      </View>
    </View>
  );
}
