import { Image, Pressable, View, type ViewStyle } from 'react-native';
import type { JobSearchItem } from '@/entities/job';
import { logoTone, matchBadge, searchItemMeta } from '@/features/job-feed';
import { humanize } from '@/shared/api';
import { useBreakpoint } from '@/shared/lib/responsive';
import { useT } from '@/shared/lib/useT';
import { accent, accentInk, link, useTheme } from '@/shared/theme';
import { LogoBadge, Txt } from '@/shared/ui';

interface Props {
  job: JobSearchItem;
  saved: boolean;
  savePending: boolean;
  onOpen: () => void;
  onApply: () => void;
  onSave: () => void;
}

/** Feed card (design 778–807): title + match badge, meta line, salary, apply + heart. */
export function JobCard({ job, saved, savePending, onOpen, onApply, onSave }: Props) {
  const t = useTheme();
  const tr = useT();
  const bp = useBreakpoint();
  const badge = matchBadge(job.match);
  const tone = logoTone(job.company || job.designation);
  const letter = (job.company || job.designation || '?').trim()[0]?.toUpperCase() ?? '?';
  const external = job.source && job.source !== 'internal';

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="link"
      accessibilityLabel={`${job.designation}, ${job.company}`}
      style={(s) =>
        ({
          flexDirection: bp.isMobile ? 'column' : 'row',
          alignItems: bp.isMobile ? 'stretch' : 'center',
          gap: bp.isMobile ? 14 : 20,
          paddingVertical: 20,
          paddingHorizontal: bp.isMobile ? 18 : 26,
          backgroundColor: t.card,
          borderRadius: 20,
          marginBottom: 10,
          shadowColor: '#141519',
          shadowOffset: { width: 0, height: (s as { hovered?: boolean }).hovered ? 12 : 1 },
          shadowOpacity: (s as { hovered?: boolean }).hovered ? 0.09 : 0.04,
          shadowRadius: (s as { hovered?: boolean }).hovered ? 32 : 2,
          transform: [{ translateY: (s as { hovered?: boolean }).hovered ? -1 : 0 }],
        }) as ViewStyle
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
        {job.compImage ? (
          <Image source={{ uri: job.compImage }} style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: t.chip }} accessibilityIgnoresInvertColors />
        ) : (
          <LogoBadge letter={letter} bg={t[tone.bg]} color={t[tone.fg]} />
        )}
        <View style={{ gap: 5, flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Txt size={18} weight="700" ls={-0.02}>
              {job.designation}
            </Txt>
            {badge && (
              <View style={{ backgroundColor: accent, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999 }}>
                <Txt size={12} weight="700" color={accentInk}>
                  {badge}
                </Txt>
              </View>
            )}
            {job.grade && (
              <View style={{ backgroundColor: t.chip, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999 }}>
                <Txt size={11.5} weight="600" color={t.mut}>
                  {job.grade === 'clevel' ? 'c-level' : humanize(job.grade)}
                </Txt>
              </View>
            )}
          </View>
          <Txt size={13.5} color={t.mut}>
            {searchItemMeta(job)}
          </Txt>
          {job.deadline && (
            <Txt size={12.5} weight="600" color={t.green}>
              {tr('apply by')} {job.deadline.slice(0, 10)}
            </Txt>
          )}
        </View>
      </View>

      <Txt size={17} weight="700" style={{ fontVariant: ['tabular-nums'], ...(bp.isMobile ? null : { flexShrink: 0 }) }}>
        {job.salary || tr('negotiable')}
      </Txt>

      <View style={{ gap: 5, alignItems: bp.isMobile ? 'flex-start' : 'center' }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={onApply}
            accessibilityRole="button"
            style={(s) => ({
              paddingVertical: 10,
              paddingHorizontal: 22,
              borderRadius: 12,
              backgroundColor: (s as { hovered?: boolean }).hovered ? link : '#141519',
            })}
          >
            <Txt size={13.5} weight="700" color="#F6F4EE">
              {tr('apply')}
            </Txt>
          </Pressable>
          <Pressable
            onPress={onSave}
            disabled={savePending}
            accessibilityRole="button"
            accessibilityLabel={saved ? tr('remove from saved') : tr('save job')}
            accessibilityState={{ selected: saved }}
            style={(s) => ({
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: saved || (s as { hovered?: boolean }).hovered ? accent : t.chip,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: savePending ? 0.6 : 1,
            })}
          >
            <Txt size={15} color={accentInk}>
              {saved ? '🖤' : '♡'}
            </Txt>
          </Pressable>
        </View>
        <Txt size={11} color={t.mut2}>
          {external ? `${tr('via')} ${humanize(job.source)}` : tr('posted on dear company')}
        </Txt>
      </View>
    </Pressable>
  );
}
