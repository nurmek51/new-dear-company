import { Pressable, View } from 'react-native';
import { useTheme } from '@/shared/theme';
import { Txt } from './Txt';

export interface CheckboxProps {
  checked: boolean;
  onPress: () => void;
  /** checked box style: dark (ink bg, filters) or accent (lime bg, onboarding consent) */
  variant?: 'dark' | 'accent';
  size?: number;
}

export function Checkbox({ checked, onPress, variant = 'dark', size = 18 }: CheckboxProps) {
  const t = useTheme();
  const bg = checked ? (variant === 'accent' ? '#B3F242' : '#141519') : t.card;
  const border = checked ? '#141519' : t.line;
  const mark = variant === 'accent' ? '#141519' : '#F6F4EE';
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: size,
        height: size,
        borderRadius: 5,
        borderWidth: 1.5,
        borderColor: border,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked ? (
        <Txt size={size - 7} weight="700" color={mark}>
          ✓
        </Txt>
      ) : (
        <View />
      )}
    </Pressable>
  );
}
