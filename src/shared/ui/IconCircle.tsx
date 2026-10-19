import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { useBreakpoint } from '@/shared/lib/responsive';
import { useTheme } from '@/shared/theme';
import { Txt } from './Txt';

export interface IconCircleProps {
  icon: string;
  label?: string;
  size?: number;
  bg?: string;
  color?: string;
  fontSize?: number;
  weight?: '400' | '500' | '600' | '700';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** 34px round icon button from the nav bar / cards. */
export function IconCircle({ icon, label, size = 34, bg, color, fontSize = 15, weight = '400', onPress, style }: IconCircleProps) {
  const t = useTheme();
  const { isMobile } = useBreakpoint();
  const targetSize = isMobile && onPress ? Math.max(44, size) : size;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label ?? icon}
      style={[
        {
          width: targetSize,
          height: targetSize,
          borderRadius: targetSize / 2,
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
