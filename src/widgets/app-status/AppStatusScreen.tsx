import { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useT } from '@/shared/lib/useT';
import { accent, accentInk, useTheme } from '@/shared/theme';
import { Txt } from '@/shared/ui';

/**
 * Full-screen app states shown before any page can render: first load,
 * a missing API address, and a server we could not reach.
 */
function Canvas({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, overflow: 'hidden', backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <View style={{ position: 'absolute', top: -96, right: -88, width: 260, height: 260, borderRadius: 130, backgroundColor: t.oc2bg, transform: [{ rotate: '12deg' }] }} />
      <View style={{ position: 'absolute', bottom: -120, left: -90, width: 270, height: 270, borderRadius: 135, backgroundColor: t.greenbg }} />
      <View style={{ width: '100%', maxWidth: 380, alignItems: 'center', gap: 18 }}>{children}</View>
    </View>
  );
}

function Card({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={{
        width: '100%',
        paddingVertical: 34,
        paddingHorizontal: 26,
        alignItems: 'center',
        gap: 13,
        backgroundColor: t.card,
        borderRadius: 28,
        shadowColor: '#141519',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.09,
        shadowRadius: 34,
      }}
    >
      {children}
    </View>
  );
}

function Mark() {
  return (
    <View style={{ width: 70, height: 70, borderRadius: 23, backgroundColor: accent, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] }}>
      <Txt size={29} weight="700" color={accentInk}>
        dc
      </Txt>
    </View>
  );
}

export function AppLoadingScreen() {
  const t = useTheme();
  const tr = useT();
  return (
    <Canvas>
      <View style={{ alignSelf: 'flex-start', marginLeft: 10, marginBottom: -31, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, backgroundColor: t.card, transform: [{ rotate: '-5deg' }], zIndex: 1 }}>
        <Txt size={11} weight="700" color={t.mut}>
          {tr('your next chapter')}
        </Txt>
      </View>
      <Card>
        <Mark />
        <View style={{ alignItems: 'center', gap: 3 }}>
          <Txt size={23} weight="700" color={t.ink} ls={-0.04}>
            {tr('dear company')}
          </Txt>
          <Txt size={13.5} color={t.mut}>
            {tr('a quieter way to look for work')}
          </Txt>
        </View>
        <View style={{ width: '100%', height: 6, marginTop: 7, overflow: 'hidden', borderRadius: 999, backgroundColor: t.chip }}>
          <View style={{ width: '58%', height: '100%', borderRadius: 999, backgroundColor: accent }} />
        </View>
      </Card>
      <Txt size={12} mono color={t.mut2}>
        {tr('getting your space ready ···')}
      </Txt>
    </Canvas>
  );
}

/** `EXPO_PUBLIC_API_BASE_URL` is not set — nothing can load, and we never fake it. */
export function AppConfigErrorScreen() {
  const t = useTheme();
  const tr = useT();
  return (
    <Canvas>
      <Card>
        <Mark />
        <Txt size={20} weight="700" color={t.ink} ls={-0.03} align="center">
          {tr('this build has no api address')}
        </Txt>
        <Txt size={13.5} color={t.mut} lh={1.55} align="center">
          {tr('set EXPO_PUBLIC_API_BASE_URL to the dear company api, then rebuild. nothing is shown until then — we never display placeholder data.')}
        </Txt>
        <View style={{ marginTop: 4, paddingVertical: 9, paddingHorizontal: 13, borderRadius: 10, backgroundColor: t.bg, width: '100%' }}>
          <Txt size={11.5} mono color={t.ink2}>
            EXPO_PUBLIC_API_BASE_URL=https://api.example.com
          </Txt>
        </View>
      </Card>
    </Canvas>
  );
}

/** The session could not be restored because the API was unreachable. */
export function AppConnectionErrorScreen({ message, onRetry, retrying }: { message?: string | null; onRetry: () => void; retrying?: boolean }) {
  const t = useTheme();
  const tr = useT();
  return (
    <Canvas>
      <Card>
        <Mark />
        <Txt size={20} weight="700" color={t.ink} ls={-0.03} align="center">
          {tr('we could not reach the server')}
        </Txt>
        <Txt size={13.5} color={t.mut} lh={1.55} align="center">
          {message ? tr(message) : tr('check your connection and try again.')}
        </Txt>
        <Pressable
          onPress={retrying ? undefined : onRetry}
          accessibilityRole="button"
          disabled={retrying}
          style={(state) => ({
            marginTop: 4,
            paddingVertical: 12,
            paddingHorizontal: 26,
            borderRadius: 12,
            backgroundColor: accent,
            opacity: retrying ? 0.6 : (state as { hovered?: boolean }).hovered ? 0.9 : 1,
          })}
        >
          <Txt size={14} weight="700" color={accentInk}>
            {retrying ? tr('trying…') : tr('try again')}
          </Txt>
        </Pressable>
      </Card>
    </Canvas>
  );
}
