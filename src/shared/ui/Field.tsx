import { TextInput, type StyleProp, type TextStyle } from 'react-native';
import { font, useTheme } from '@/shared/theme';

export interface FieldProps {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  multiline?: boolean;
  /** design inputs: chip-ish bg, radius 12, padding 12 14, font 14 */
  bg?: string;
  size?: number;
  radius?: number;
  borderColor?: string;
  onSubmitEditing?: () => void;
  style?: StyleProp<TextStyle>;
}

export function Field({
  value,
  onChangeText,
  placeholder,
  secure = false,
  multiline = false,
  bg,
  size = 14,
  radius = 12,
  borderColor = 'transparent',
  onSubmitEditing,
  style,
}: FieldProps) {
  const t = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={t.mut2}
      secureTextEntry={secure}
      multiline={multiline}
      onSubmitEditing={onSubmitEditing}
      style={[
        {
          backgroundColor: bg ?? t.card2,
          borderRadius: radius,
          borderWidth: 2,
          borderColor,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: size,
          color: t.ink,
          fontFamily: font.regular,
          ...(multiline ? { minHeight: 96, textAlignVertical: 'top' as const } : null),
          outlineStyle: 'none',
        } as unknown as TextStyle,
        style,
      ]}
    />
  );
}
