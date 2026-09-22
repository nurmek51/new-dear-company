import { View } from 'react-native';
import { Txt } from './Txt';

export interface LogoBadgeProps {
  letter: string;
  bg: string;
  color: string;
  size?: number;
  radius?: number;
  fontSize?: number;
}

/** Company logo placeholder — colored rounded square with a letter. */
export function LogoBadge({ letter, bg, color, size = 46, radius = 13, fontSize = 18 }: LogoBadgeProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Txt size={fontSize} weight="700" color={color}>
        {letter}
      </Txt>
    </View>
  );
}
