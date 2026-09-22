import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/shared/theme';
import { Txt, type Weight } from './Txt';

export interface ChipProps {
  label: string;
  bg?: string;
  color?: string;
  weight?: Weight;
  size?: number;
  /** padding: 7px 14px by default (filter chips); nav uses 7px 13px */
  px?: number;
  py?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Rounded pill chip — the design's most common interactive element. */
export function Chip({ label, bg, color, weight = '500', size = 13, px = 14, py = 7, onPress, style }: ChipProps) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={(state) => [
        {
          paddingHorizontal: px,
          paddingVertical: py,
          borderRadius: 999,
          backgroundColor: bg ?? t.chip,
          opacity: (state as { hovered?: boolean }).hovered ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Txt size={size} weight={weight} color={color ?? t.ink2} style={{ whiteSpace: 'nowrap' } as never}>
        {label}
      </Txt>
    </Pressable>
  );
}
