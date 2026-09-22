import { View } from 'react-native';
import { accent } from '@/shared/theme';

/** The design's lime cat-face envelope mark (seeker.html done state, 44×37). */
export function AppliedMark({ size = 44, color = accent, eye = '#141519' }: { size?: number; color?: string; eye?: string }) {
  const k = size / 44;
  return (
    <View style={{ width: size, height: 37 * k }}>
      <View style={{ position: 'absolute', bottom: 0, width: size, height: 28 * k, backgroundColor: color, borderTopLeftRadius: 12 * k, borderTopRightRadius: 12 * k, borderBottomLeftRadius: 13 * k, borderBottomRightRadius: 13 * k }} />
      <View style={{ position: 'absolute', top: 0, left: 3 * k, width: 0, height: 0, borderLeftWidth: 9 * k, borderRightWidth: 9 * k, borderBottomWidth: 13 * k, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color }} />
      <View style={{ position: 'absolute', top: 0, right: 3 * k, width: 0, height: 0, borderLeftWidth: 9 * k, borderRightWidth: 9 * k, borderBottomWidth: 13 * k, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color }} />
      <View style={{ position: 'absolute', bottom: 10 * k, left: 12 * k, width: 5 * k, height: 5 * k, borderRadius: 2.5 * k, backgroundColor: eye }} />
      <View style={{ position: 'absolute', bottom: 10 * k, right: 12 * k, width: 5 * k, height: 5 * k, borderRadius: 2.5 * k, backgroundColor: eye }} />
    </View>
  );
}
