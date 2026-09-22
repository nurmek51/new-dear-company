import type { ReactNode } from 'react';
import { Pressable, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { accent, danger, font, useTheme } from '@/shared/theme';
import { Txt } from '@/shared/ui';

/** 11.5/600 muted field label (recruiter.html 1133). */
export function Label({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Txt size={11.5} weight="600" color={t.mut}>{children}</Txt>;
}

/** Design input: border l15, radius 9, padding 9 13, 13.5px, bg hov (recruiter.html 1133). */
export function Input({
  value,
  onChangeText,
  placeholder,
  multiline,
  minHeight,
  disabled,
  keyboard,
  label,
  style,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  minHeight?: number;
  disabled?: boolean;
  keyboard?: 'default' | 'numeric';
  /** accessibility label */
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={t.mut2}
      multiline={multiline}
      editable={!disabled}
      keyboardType={keyboard ?? 'default'}
      accessibilityLabel={label}
      style={[
        {
          borderWidth: 1,
          borderColor: t.l15,
          borderRadius: 9,
          paddingVertical: multiline ? 11 : 9,
          paddingHorizontal: 13,
          fontSize: multiline ? 13 : 13.5,
          backgroundColor: t.hov,
          fontFamily: font.regular,
          color: t.ink,
          opacity: disabled ? 0.55 : 1,
          outlineStyle: 'none',
          ...(multiline ? { minHeight: minHeight ?? 56, textAlignVertical: 'top' as const } : null),
        } as never,
        style,
      ]}
    />
  );
}

export function FieldBlock({ label, error, children, style }: { label: string; error?: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: 6, minWidth: 0 }, style]}>
      <Label>{label}</Label>
      {children}
      {error ? <Txt size={11.5} color={danger}>{error}</Txt> : null}
    </View>
  );
}

/** Selectable chip from the prototype's mkChips (recruiter.html 1782): 12/600, radius 999, padding 6 12. */
export function PickChip({ label, active, onPress, disabled }: { label: string; active: boolean; onPress: () => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: !!disabled }}
      style={(s) => ({
        borderRadius: 999,
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: active ? '#141519' : t.card,
        borderWidth: 1,
        borderColor: active ? '#141519' : (s as { hovered?: boolean }).hovered && !disabled ? t.ink : t.l12,
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <Txt size={12} weight="600" color={active ? accent : t.ink}>{label}</Txt>
    </Pressable>
  );
}

/** Numbered section header: 22px #141519 circle with a mono accent digit (recruiter.html 1131). */
export function StepHeader({ n, title, hint }: { n: string; title: string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#141519', alignItems: 'center', justifyContent: 'center' }}>
        <Txt size={11} weight="700" mono color={accent}>{n}</Txt>
      </View>
      <Txt size={14} weight="700">{title}</Txt>
      {hint ? <Txt size={12} color={t.mut}>{hint}</Txt> : null}
    </View>
  );
}

/** Card: bg card, border l10, radius 14, padding 20 22. */
export function FormCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[{ backgroundColor: t.card, borderWidth: 1, borderColor: t.l10, borderRadius: 14, paddingVertical: 20, paddingHorizontal: 22 }, style]}>
      {children}
    </View>
  );
}
