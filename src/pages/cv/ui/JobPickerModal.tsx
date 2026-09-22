import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { jobsApi, type JobSearchItem } from '@/entities/job';
import { errorMessageFrom } from '@/shared/api';
import { useT } from '@/shared/lib/useT';
import { useTheme } from '@/shared/theme';
import { Btn, Field, Overlay, Txt } from '@/shared/ui';

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  onPick: (job: JobSearchItem) => void;
}

/** Small search-and-pick over GET /jobs/search/ (spec §2.3) to feed the "for a job" AI actions. */
export function JobPickerModal({ visible, title, onClose, onPick }: Props) {
  const t = useTheme();
  const tr = useT();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<JobSearchItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const page = await jobsApi.searchJobs({ q: query.trim() || undefined, page: 1, page_size: 8 });
      setRows(page.results);
    } catch (err) {
      const e = err as { payload?: unknown; message?: string };
      setError(errorMessageFrom(e.payload, e.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && rows === null && !loading) void search('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Overlay visible={visible} onClose={onClose} width={460} padding={24} radius={22}>
      <View style={{ flexDirection: 'column', gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Txt size={17} weight="700" ls={-0.02} style={{ flex: 1 }}>{title}</Txt>
          <Pressable accessibilityRole="button" accessibilityLabel={tr('close')} onPress={onClose} style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
            <Txt size={14} color={t.mut}>✕</Txt>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Field value={q} onChangeText={setQ} placeholder={tr('search jobs by title or company')} onSubmitEditing={() => void search(q)} />
          </View>
          <Btn label={tr('search')} size={13} px={16} py={12} onPress={() => void search(q)} disabled={loading} />
        </View>
        {loading && <ActivityIndicator color={t.mut} accessibilityLabel={tr('loading')} />}
        {error && (
          <View style={{ flexDirection: 'column', gap: 8 }}>
            <Txt size={12.5} color="#b91c1c">{error}</Txt>
            <Btn label={tr('retry')} size={13} px={16} py={9} onPress={() => void search(q)} style={{ alignSelf: 'flex-start' }} />
          </View>
        )}
        {!loading && !error && rows && rows.length === 0 && (
          <Txt size={13} color={t.mut}>{tr('no jobs found — try another search')}</Txt>
        )}
        {!loading && rows && rows.length > 0 && (
          <View style={{ flexDirection: 'column', gap: 6, maxHeight: 320 }}>
            {rows.map((j) => (
              <Pressable
                key={j.id}
                accessibilityRole="button"
                onPress={() => onPick(j)}
                style={(state) => ({
                  borderWidth: 1,
                  borderColor: t.chip,
                  borderRadius: 13,
                  paddingVertical: 11,
                  paddingHorizontal: 14,
                  backgroundColor: (state as { hovered?: boolean }).hovered ? t.hov : t.card,
                  flexDirection: 'column',
                  gap: 2,
                })}
              >
                <Txt size={13.5} weight="700" numberOfLines={1}>{j.designation}</Txt>
                <Txt size={12.5} color={t.mut} numberOfLines={1}>
                  {[j.company, j.job_locations[0]?.locality].filter(Boolean).join(' · ')}
                </Txt>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </Overlay>
  );
}
