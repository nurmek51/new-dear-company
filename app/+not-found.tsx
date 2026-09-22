import { router } from 'expo-router';
import { View } from 'react-native';
import { useT } from '@/shared/lib/useT';
import { useTheme } from '@/shared/theme';
import { Btn, Txt } from '@/shared/ui';

export default function NotFoundScreen() {
  const t = useTheme();
  const tr = useT();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <View style={{ maxWidth: 420, width: '100%', alignItems: 'center', gap: 14, padding: 32, backgroundColor: t.card, borderRadius: 24 }}>
        <Txt size={46} weight="700">404</Txt>
        <Txt size={20} weight="700" align="center">{tr('this page doesn’t exist')}</Txt>
        <Txt size={14} color={t.mut} align="center">{tr('it may have moved, or the link may be incomplete.')}</Txt>
        <Btn label={tr('back to the feed')} onPress={() => router.replace('/jobs')} />
      </View>
    </View>
  );
}
