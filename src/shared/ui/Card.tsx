import { type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/shared/theme';

export interface CardProps {
  radius?: number;
  padding?: number;
  gap?: number;
  bg?: string;
  /** design shadow: 0 1px 2px rgba(20,21,25,.04) */
  shadow?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

export function Card({ radius = 20, padding = 22, gap, bg, shadow = true, style, children }: CardProps) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: bg ?? t.card,
          borderRadius: radius,
          padding,
          ...(gap != null ? { gap } : null),
          ...(shadow
            ? {
                shadowColor: '#141519',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 2,
              }
            : null),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
