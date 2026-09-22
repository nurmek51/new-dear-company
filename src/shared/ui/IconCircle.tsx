import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/shared/theme';
import { Txt } from './Txt';

export interface IconCircleProps {
  icon: string;
  size?: number;
  bg?: string;
  color?: string;
  fontSize?: number;
  weight?: '400' | '500' | '600' | '700';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** 34px round icon button from the nav bar / cards. */
export function IconCircle({ icon, size = 34, bg, color, fontSize = 15, weight = '400', onPress, style }: IconCircleProps) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg ?? t.chip,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Txt size={fontSize} weight={weight} color={color}>
        {icon}
      </Txt>
    </Pressable>
  );
}
