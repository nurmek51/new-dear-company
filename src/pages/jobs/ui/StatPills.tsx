import { Pressable, View } from 'react-native';
import { DATE_PRESETS, type DatePreset, type JobStats } from '@/features/job-feed';
import { useT } from '@/shared/lib/useT';
import { accent, useTheme } from '@/shared/theme';
import { Txt } from '@/shared/ui';

interface Props {
  stats: JobStats;
  loading: boolean;
  active: DatePreset | null;
  onPick: (key: DatePreset) => void;
}

/** Design 639–647: four period pills with real counts; the active one is ink/accent. */
export function StatPills({ stats, loading, active, onPick }: Props) {
  const t = useTheme();
  const tr = useT();
  const fmt = (n: number | undefined) => (n == null ? (loading ? '…' : '—') : n.toLocaleString('en-US'));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {DATE_PRESETS.map((p) => {
        const on = p.key === active;
        return (
          <Pressable
            key={p.key}
            onPress={() => onPick(p.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              gap: 8,
              backgroundColor: on ? '#141519' : t.card,
              borderRadius: 14,
              paddingVertical: 10,
              paddingHorizontal: 16,
              shadowColor: '#141519',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 2,
            }}
          >
            <Txt size={17} weight="700" color={on ? accent : t.ink} style={{ fontVariant: ['tabular-nums'] }}>
              {fmt(stats[p.key])}
            </Txt>
            <Txt size={12.5} weight="600" color={on ? t.mut2 : t.mut}>
              {tr(p.label)}
            </Txt>
          </Pressable>
        );
      })}
      <Txt size={12.5} color={t.mut2}>
        {tr('openings · tap a period to filter the feed')}
      </Txt>
    </View>
  );
}
