import { type ReactNode } from 'react';
import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { font, useTheme } from '@/shared/theme';

export type Weight = '400' | '500' | '600' | '700';

const family: Record<Weight, string> = {
  '400': font.regular,
  '500': font.medium,
  '600': font.semibold,
  '700': font.bold,
};

export interface TxtProps extends TextProps {
  size?: number;
  weight?: Weight;
  color?: string;
  mono?: boolean;
  /** line-height multiplier, like CSS line-height */
  lh?: number;
  /** letter-spacing in em, like CSS (e.g. -0.04) */
  ls?: number;
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
  children?: ReactNode;
}

/** Text with the design's Space Grotesk / Space Mono families and ink default. */
export function Txt({
  size = 14,
  weight = '400',
  color,
  mono = false,
  lh,
  ls,
  align,
  style,
  children,
  ...rest
}: TxtProps) {
  const t = useTheme();
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: mono ? (weight === '700' ? font.monoBold : font.mono) : family[weight],
          fontSize: size,
          color: color ?? t.ink,
          ...(lh != null ? { lineHeight: size * lh } : null),
          ...(ls != null ? { letterSpacing: size * ls } : null),
          ...(align ? { textAlign: align } : null),
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
