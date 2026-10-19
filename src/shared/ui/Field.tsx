import { useState } from 'react';
import { TextInput, type StyleProp, type TextStyle, type TextInputProps } from 'react-native';
import { useBreakpoint } from '@/shared/lib/responsive';
import { font, link, useTheme } from '@/shared/theme';

export interface FieldProps {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  inputMode?: TextInputProps['inputMode'];
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
  inputMode,
  multiline = false,
  bg,
  size = 14,
  radius = 12,
  borderColor = 'transparent',
  onSubmitEditing,
  style,
}: FieldProps) {
  const t = useTheme();
  const { isMobile } = useBreakpoint();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      accessibilityLabel={placeholder}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={t.mut2}
      secureTextEntry={secure}
      inputMode={inputMode}
      multiline={multiline}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onSubmitEditing={onSubmitEditing}
      style={[
        {
          minWidth: 0,
          minHeight: 48,
          backgroundColor: bg ?? t.card2,
          borderRadius: radius,
          borderWidth: 2,
          borderColor: focused ? link : borderColor,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: isMobile ? Math.max(16, size) : size,
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
