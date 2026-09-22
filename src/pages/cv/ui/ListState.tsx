import { ActivityIndicator, View } from 'react-native';
import { useT } from '@/shared/lib/useT';
import { useTheme } from '@/shared/theme';
import { Btn, Txt } from '@/shared/ui';

interface Props {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyText: string;
  onRetry: () => void;
}

/** Loading / error+retry / empty states for the document lists (never a false empty). */
export function ListState({ loading, error, empty, emptyText, onRetry }: Props) {
  const t = useTheme();
  const tr = useT();
  if (loading) return <ActivityIndicator color={t.mut} accessibilityLabel={tr('loading')} style={{ paddingVertical: 10 }} />;
  if (error) {
    return (
      <View style={{ flexDirection: 'column', gap: 8 }}>
        <Txt size={12.5} color="#b91c1c" lh={1.5}>{error}</Txt>
        <Btn label={tr('retry')} size={13} px={16} py={9} onPress={onRetry} style={{ alignSelf: 'flex-start' }} />
      </View>
    );
  }
  if (empty) return <Txt size={13} color={t.mut} lh={1.55}>{emptyText}</Txt>;
  return null;
}
