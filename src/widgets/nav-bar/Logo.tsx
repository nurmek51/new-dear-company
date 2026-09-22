import { Pressable, View } from 'react-native';
import { link, useTheme } from '@/shared/theme';
import { Txt } from '@/shared/ui';

/** The "dear company," envelope logo, rebuilt from the prototype's CSS shapes. */
export function Logo({ onPress }: { onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ position: 'relative', width: 26, height: 22 }}>
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            width: 26,
            height: 17,
            backgroundColor: t.ink,
            borderTopLeftRadius: 7,
            borderTopRightRadius: 7,
            borderBottomLeftRadius: 8,
            borderBottomRightRadius: 8,
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 2,
            width: 0,
            height: 0,
            borderLeftWidth: 5,
            borderRightWidth: 5,
            borderBottomWidth: 8,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: t.ink,
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 2,
            width: 0,
            height: 0,
            borderLeftWidth: 5,
            borderRightWidth: 5,
            borderBottomWidth: 8,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: t.ink,
          }}
        />
        <View style={{ position: 'absolute', bottom: 6, left: 7, width: 3, height: 3, borderRadius: 2, backgroundColor: '#B3F242' }} />
        <View style={{ position: 'absolute', bottom: 6, right: 7, width: 3, height: 3, borderRadius: 2, backgroundColor: '#B3F242' }} />
      </View>
      <Txt size={16} weight="700" ls={-0.02}>
        dear company
        <Txt size={16} weight="700" color={link}>
          ,
        </Txt>
      </Txt>
    </Pressable>
  );
}
