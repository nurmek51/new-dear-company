import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { accent, useTheme } from '@/shared/theme';

/**
 * The design's roast progress bar (height 6, radius 99, chip track, lime fill).
 * The backend reports no percentage, so the fill sweeps (indeterminate) instead of faking one.
 */
export function ProgressBar() {
  const t = useTheme();
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(x, { toValue: 1, duration: 1100, useNativeDriver: false }),
        Animated.timing(x, { toValue: 0, duration: 1100, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [x]);
  const left = x.interpolate({ inputRange: [0, 1], outputRange: ['0%', '65%'] });
  return (
    <View style={{ height: 6, borderRadius: 99, backgroundColor: t.chip, overflow: 'hidden' }}>
      <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, left, width: '35%', backgroundColor: accent, borderRadius: 99 }} />
    </View>
  );
}
