import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { accent, accentInk, useTheme } from '@/shared/theme';
import { Txt, type Weight } from './Txt';

export interface BtnProps {
  label: string;
  /** visual variant: dark (ink bg), accent (lime), muted (chip bg) or custom via bg/color */
  variant?: 'dark' | 'accent' | 'muted';
  bg?: string;
  color?: string;
  size?: number;
  weight?: Weight;
  radius?: number;
  px?: number;
  py?: number;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Rectangular action button (radius 12–13 in the design). */
export function Btn({
  label,
  variant = 'dark',
  bg,
  color,
  size = 14,
  weight = '700',
  radius = 12,
  px = 22,
  py = 12,
  disabled = false,
  onPress,
  style,
}: BtnProps) {
  const t = useTheme();
  const bgColor =
    bg ?? (variant === 'accent' ? accent : variant === 'muted' ? t.chip : '#141519');
  const fgColor =
    color ?? (variant === 'accent' ? accentInk : variant === 'muted' ? t.mut : '#F6F4EE');
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={(state) => [
        {
          paddingHorizontal: px,
          paddingVertical: py,
          borderRadius: radius,
          backgroundColor: bgColor,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: (state as { hovered?: boolean }).hovered && !disabled ? 0.9 : 1,
          ...(disabled ? { cursor: 'default' } : null),
        } as ViewStyle,
        style,
      ]}
    >
      <Txt size={size} weight={weight} color={fgColor} align="center">
        {label}
      </Txt>
    </Pressable>
  );
}
