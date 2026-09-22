import { type ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { accent, accentInk, useTheme } from '@/shared/theme';
import { Field, Txt } from '@/shared/ui';

/** The design's cat mark (sign-in: 26×22; onboarding: 52×44). */
export function CatMark({ size = 26 }: { size?: 26 | 52 }) {
  const t = useTheme();
  const big = size === 52;
  const w = big ? 52 : 26;
  const h = big ? 44 : 22;
  const bodyH = big ? 34 : 17;
  const ear = big ? 10 : 5;
  const earH = big ? 15 : 8;
  const earOff = big ? 4 : 2;
  const eye = big ? 6 : 3;
  const eyeB = big ? 13 : 6;
  const eyeX = big ? 14 : 7;
  const rTop = big ? 14 : 7;
  const rBot = big ? 16 : 8;
  const earStyle = {
    position: 'absolute' as const,
    top: 0,
    width: 0,
    height: 0,
    borderLeftWidth: ear,
    borderRightWidth: ear,
    borderBottomWidth: earH,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: t.ink,
  };
  return (
    <View style={{ width: w, height: h }}>
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          width: w,
          height: bodyH,
          backgroundColor: t.ink,
          borderTopLeftRadius: rTop,
          borderTopRightRadius: rTop,
          borderBottomLeftRadius: rBot,
          borderBottomRightRadius: rBot,
        }}
      />
      <View style={[earStyle, { left: earOff }]} />
      <View style={[earStyle, { right: earOff }]} />
      <View style={{ position: 'absolute', bottom: eyeB, left: eyeX, width: eye, height: eye, borderRadius: eye / 2, backgroundColor: accent }} />
      <View style={{ position: 'absolute', bottom: eyeB, right: eyeX, width: eye, height: eye, borderRadius: eye / 2, backgroundColor: accent }} />
    </View>
  );
}

/** Lime highlighted word, rotated -1.2deg like the design's h1 accents. */
export function Highlight({ children, size, radius = 8, px = 10 }: { children: ReactNode; size: number; radius?: number; px?: number }) {
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: accent, borderRadius: radius, paddingHorizontal: px, transform: [{ rotate: '-1.2deg' }] }}>
      <Txt size={size} weight="700" color={accentInk} ls={-0.03} lh={1.25}>
        {children}
      </Txt>
    </View>
  );
}

/** Text-only pressable link (design: font-weight 600, hover → ink). */
export function TextLink({
  label,
  onPress,
  size = 11.5,
  color,
  weight = '600',
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  size?: number;
  color?: string;
  weight?: '500' | '600' | '700';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={(s) => [{ opacity: (s as { hovered?: boolean }).hovered && !disabled ? 0.75 : 1 }, style]}
    >
      <Txt size={size} weight={weight} color={color ?? t.ink}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** The auth card input: 1.5px chip border, radius 12, padding 12 15, 13.5px, card bg. */
export function AuthField(props: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  secure?: boolean;
  onSubmitEditing?: () => void;
  invalid?: boolean;
}) {
  const t = useTheme();
  return (
    <Field
      value={props.value}
      onChangeText={props.onChangeText}
      placeholder={props.placeholder}
      secure={props.secure}
      onSubmitEditing={props.onSubmitEditing}
      bg={t.card}
      size={13.5}
      radius={12}
      borderColor={props.invalid ? '#b91c1c' : t.chip}
      style={{ paddingHorizontal: 15, paddingVertical: 12, borderWidth: 1.5 }}
    />
  );
}

/** "continue →" style CTA: accent when enabled, chip/mut2 when not (design authBg/authColor). */
export function AuthCta({ label, enabled, busy, onPress }: { label: string; enabled: boolean; busy?: boolean; onPress: () => void }) {
  const t = useTheme();
  const on = enabled && !busy;
  return (
    <Pressable
      onPress={on ? onPress : undefined}
      accessibilityRole="button"
      accessibilityState={{ disabled: !on, busy }}
      style={(s) => ({
        alignItems: 'center',
        paddingVertical: 13,
        borderRadius: 12,
        backgroundColor: on ? accent : t.chip,
        opacity: (s as { hovered?: boolean }).hovered && on ? 0.9 : 1,
        ...(on ? null : { cursor: 'default' }),
      }) as ViewStyle}
    >
      <Txt size={14} weight="700" color={on ? accentInk : t.mut2}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** Outline secondary button (design's google button shape). */
export function OutlineBtn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={(s) => ({
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: t.card,
        borderWidth: 1.5,
        borderColor: (s as { hovered?: boolean }).hovered && !disabled ? t.ink : t.chip,
        opacity: disabled ? 0.6 : 1,
      }) as ViewStyle}
    >
      <Txt size={13} weight="600" color={t.ink}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** Inline error line (danger color, 12px). */
export function ErrorLine({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <Txt size={12} weight="600" color="#b91c1c" lh={1.5} accessibilityLiveRegion="polite">
      {text}
    </Txt>
  );
}

/** Centered 400px auth canvas (mobile: 100%, max 460). */
export function AuthCanvas({ children, width = 400 }: { children: ReactNode; width?: number }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 24 }}>
      <View style={{ width: '100%', maxWidth: width, gap: 16 }}>{children}</View>
    </View>
  );
}
