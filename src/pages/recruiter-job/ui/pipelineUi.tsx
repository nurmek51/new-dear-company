import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { avatarIndex, initialsOf } from '@/entities/candidate-pool';
import { stageOf, type PipelineStage } from '@/entities/applicant';
import { humanize } from '@/shared/api';
import { accent, useTheme } from '@/shared/theme';
import { Txt } from '@/shared/ui';

/** Avatar palette from the prototype's candidate data (recruiter.html 1665–1678). */
export const AVATAR_PALETTE: [string, string][] = [
  ['#ECE9E0', '#52525b'],
  ['#DBE7FC', '#1e40af'],
  ['#DCF2E3', '#166534'],
  ['#FCE8DC', '#9a3412'],
  ['#EFE3FB', '#6d28d9'],
];

export function avatarColors(seed: string | null | undefined): [string, string] {
  return AVATAR_PALETTE[avatarIndex(seed, AVATAR_PALETTE.length)];
}

export function Avatar({
  name,
  uri,
  size = 36,
  radius,
  fontSize = 13,
}: {
  name: string;
  uri?: string | null;
  size?: number;
  radius?: number;
  fontSize?: number;
}) {
  const [bg, color] = avatarColors(name);
  const r = radius ?? size / 2;
  if (uri) {
    return (
      <Image
        source={{ uri }}
        accessibilityIgnoresInvertColors
        accessibilityLabel={name}
        style={{ width: size, height: size, borderRadius: r, backgroundColor: bg }}
      />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: r, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Txt size={fontSize} weight="700" color={color}>{initialsOf(name)}</Txt>
    </View>
  );
}

/** Stage pill colors (recruiter.html stagePill + the archive's rejected badge). */
export const STAGE_PILL: Record<PipelineStage, { bg: string; color: string }> = {
  applied: { bg: '#ECE9E0', color: '#52525b' },
  screening: { bg: '#DBE7FC', color: '#1e40af' },
  interview: { bg: '#B3F242', color: '#141519' },
  offer: { bg: '#FCE8DC', color: '#9a3412' },
  hired: { bg: '#141519', color: '#B3F242' },
  closed: { bg: '#FEE2E2', color: '#b91c1c' },
};

export function StatusPill({ status, size = 11.5 }: { status: string; size?: number }) {
  const p = STAGE_PILL[stageOf(status)];
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: p.bg, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10 }}>
      <Txt size={size} weight="600" color={p.color}>{humanize(status)}</Txt>
    </View>
  );
}

/** 12.5/600 outlined action (recruiter.html header buttons: border l15, radius 8, padding 6 12). */
export function OutlineBtn({
  label,
  onPress,
  disabled,
  danger,
  style,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  danger?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={(s) => [
        {
          borderWidth: 1,
          borderColor: (s as { hovered?: boolean }).hovered && !disabled ? (danger ? '#dc2626' : t.ink) : t.l15,
          borderRadius: 8,
          paddingVertical: 6,
          paddingHorizontal: 12,
          backgroundColor: t.card,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {(s) => (
        <Txt size={12.5} weight="600" color={(s as { hovered?: boolean }).hovered && danger ? '#dc2626' : t.ink} style={{ whiteSpace: 'nowrap' } as never}>
          {label}
        </Txt>
      )}
    </Pressable>
  );
}

/** Dark accent action (recruiter.html: bg #141519, color #B3F242, radius 8, padding 7 13). */
export function DarkBtn({ label, onPress, disabled, style }: { label: string; onPress?: () => void; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={(s) => [
        {
          backgroundColor: (s as { hovered?: boolean }).hovered && !disabled ? '#26272e' : '#141519',
          paddingVertical: 7,
          paddingHorizontal: 13,
          borderRadius: 8,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <Txt size={12.5} weight="600" color={accent} style={{ whiteSpace: 'nowrap' } as never}>{label}</Txt>
    </Pressable>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <Txt size={12} weight="700" color={t.mut} ls={0.05} style={{ textTransform: 'uppercase' }}>
      {children}
    </Txt>
  );
}

/** Client toast (recruiter.html 1545–1557): fixed bottom, #141519 on #F6F4EE, 5s. */
export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const show = (m: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMsg(m);
    timer.current = setTimeout(() => setMsg(null), 5000);
  };
  return { msg, show };
}

export function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 10, right: 10, bottom: 24, alignItems: 'center', zIndex: 90 }}>
      <View
        accessibilityLiveRegion="polite"
        style={{
          backgroundColor: '#141519',
          borderRadius: 12,
          paddingVertical: 12,
          paddingHorizontal: 18,
          shadowColor: '#141519',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.3,
          shadowRadius: 30,
        }}
      >
        <Txt size={13} weight="600" color="#F6F4EE">{msg}</Txt>
      </View>
    </View>
  );
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toLowerCase();
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`.toLowerCase();
}
