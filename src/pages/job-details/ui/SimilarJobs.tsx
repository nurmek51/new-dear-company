import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, View, type ViewStyle } from 'react-native';
import { jobsApi, type JobSearchItem } from '@/entities/job';
import { logoTone, searchItemMeta } from '@/features/job-feed';
import { useT } from '@/shared/lib/useT';
import { link, useTheme } from '@/shared/theme';
import { LogoBadge, Txt } from '@/shared/ui';

interface Props {
  jobId: string;
}

/** "similar jobs, while you're here" rail (design 1373–1385) — spec §5 similar-jobs. */
export function SimilarJobs({ jobId }: Props) {
  const t = useTheme();
  const tr = useT();
  const [rows, setRows] = useState<JobSearchItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setRows(null);
    setFailed(false);
    jobsApi
      .similarJobs(jobId, 6)
      .then((r) => alive && setRows(r))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [jobId]);

  if (failed || (rows && rows.length === 0)) return null;

  return (
    <View style={{ gap: 10, marginTop: 8 }}>
      <Txt size={15} weight="700">
        {tr('similar jobs, while you’re here')}
      </Txt>
      {!rows && <ActivityIndicator color={t.mut} style={{ alignSelf: 'flex-start' }} />}
      {rows?.map((j) => {
        const tone = logoTone(j.company || j.designation);
        const letter = (j.company || j.designation || '?').trim()[0]?.toUpperCase() ?? '?';
        return (
          <Pressable
            key={j.id}
            onPress={() => router.push(`/job/${j.id}` as never)}
            accessibilityRole="link"
            accessibilityLabel={`${j.designation}, ${j.company}`}
            style={(s) =>
              ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                paddingVertical: 14,
                paddingHorizontal: 18,
                backgroundColor: t.card,
                borderRadius: 16,
                shadowColor: '#141519',
                shadowOffset: { width: 0, height: (s as { hovered?: boolean }).hovered ? 8 : 1 },
                shadowOpacity: (s as { hovered?: boolean }).hovered ? 0.09 : 0.04,
                shadowRadius: (s as { hovered?: boolean }).hovered ? 24 : 2,
                transform: [{ translateY: (s as { hovered?: boolean }).hovered ? -1 : 0 }],
              }) as ViewStyle
            }
          >
            {j.compImage ? (
              <Image source={{ uri: j.compImage }} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: t.chip }} accessibilityIgnoresInvertColors />
            ) : (
              <LogoBadge letter={letter} bg={t[tone.bg]} color={t[tone.fg]} size={38} radius={12} fontSize={14} />
            )}
            <View style={{ gap: 2, flex: 1, minWidth: 0 }}>
              <Txt size={14.5} weight="700">
                {j.designation}
              </Txt>
              <Txt size={12.5} color={t.mut}>
                {searchItemMeta(j)}
              </Txt>
            </View>
            <Txt size={13} weight="600" color={link}>
              {tr('view →')}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
