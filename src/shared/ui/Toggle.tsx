import { Pressable, View } from 'react-native';
import { accent, useTheme } from '@/shared/theme';

export interface ToggleProps {
  on: boolean;
  onPress: () => void;
}

/** 38×22 pill switch with a 16px knob (profile notification toggles). */
export function Toggle({ on, onPress }: ToggleProps) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 38,
        height: 22,
        borderRadius: 999,
        backgroundColor: on ? accent : t.chip,
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          position: 'absolute',
          left: on ? 19 : 3,
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: '#141519',
        }}
      />
    </Pressable>
  );
}
