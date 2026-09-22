import { router, usePathname } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { useAuth } from '@/entities/user';
import { useCalmSound } from '@/features/calm-sound';
import { LANGS } from '@/shared/i18n';
import { useBreakpoint } from '@/shared/lib/responsive';
import { useLangStore, useT } from '@/shared/lib/useT';
import { accent, link, useTheme, useThemeStore } from '@/shared/theme';
import { Chip, IconCircle, Txt } from '@/shared/ui';
import { Logo } from './Logo';

interface NavUiState {
  langMenuOpen: boolean;
  toggleLangMenu: () => void;
  closeAll: () => void;
}

export const useNavUi = create<NavUiState>((set) => ({
  langMenuOpen: false,
  toggleLangMenu: () => set((s) => ({ langMenuOpen: !s.langMenuOpen })),
  closeAll: () => set({ langMenuOpen: false }),
}));

/** Seeker nav (design lines 513–565). Notifications bell hidden: no endpoint. */
const navDefs = [
  { key: 'jobs', label: 'jobs' },
  { key: 'applications', label: 'applications' },
  { key: 'saved', label: 'saved' },
  { key: 'cv', label: 'my cv' },
];

export function NavBar() {
  const t = useTheme();
  const bp = useBreakpoint();
  const tr = useT();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const signedIn = useAuth((s) => s.status === 'signedIn');
  const user = useAuth((s) => s.user);
  const dark = useThemeStore((s) => s.dark);
  const toggleDark = useThemeStore((s) => s.toggleDark);
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const { langMenuOpen, toggleLangMenu } = useNavUi();
  const { rainOn, toggle: toggleRain } = useCalmSound();

  const active = pathname.replace(/^\//, '').split('/')[0] || 'jobs';
  const avatarLetter = (user?.name?.trim()?.[0] ?? 'u').toLowerCase();
  const isPlus = !!user?.subscription?.is_active;

  const navChips = (
    <>
      {navDefs.map((n) => (
        <Chip
          key={n.key}
          label={tr(n.label)}
          size={13.5}
          px={13}
          py={7}
          bg={n.key === active ? '#141519' : 'transparent'}
          color={n.key === active ? '#F6F4EE' : t.mut}
          weight="500"
          onPress={() => router.push(`/${n.key}` as never)}
        />
      ))}
      <Chip
        label={tr('plus ✦')}
        size={13.5}
        px={13}
        py={7}
        weight="700"
        bg={active === 'plus' ? '#141519' : 'transparent'}
        color={active === 'plus' ? accent : link}
        onPress={() => router.push('/plus' as never)}
      />
    </>
  );

  const langMenu = (
    <View style={{ position: 'relative' }}>
      <Pressable
        onPress={toggleLangMenu}
        accessibilityRole="button"
        accessibilityLabel="language"
        style={{ height: 34, borderRadius: 999, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4, paddingHorizontal: 10 }}
      >
        <Txt size={11} weight="700" mono>
          {lang.toUpperCase()} ▾
        </Txt>
      </Pressable>
      {langMenuOpen && (
        <View
          style={{ position: 'absolute', top: 40, right: 0, backgroundColor: t.card, borderWidth: 1, borderColor: 'rgba(20,21,25,0.12)', borderRadius: 13, padding: 6, gap: 2, zIndex: 96, minWidth: 150, shadowColor: '#141519', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.16, shadowRadius: 36, elevation: 12 }}
        >
          {LANGS.map((lo) => {
            const isActive = lang === lo.code;
            return (
              <Pressable
                key={lo.code}
                onPress={() => {
                  setLang(lo.code);
                  useNavUi.getState().closeAll();
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 11, borderRadius: 9, backgroundColor: isActive ? '#141519' : 'transparent' }}
              >
                <Txt size={10} mono color={isActive ? accent : t.ink} style={{ opacity: 0.6 }}>
                  {lo.code.toUpperCase()}
                </Txt>
                <Txt size={13} weight="600" color={isActive ? accent : t.ink}>
                  {lo.name}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );

  const rightCluster = (
    <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {bp.isDesktop && (
        <Pressable
          onPress={() => router.push('/recruiter' as never)}
          accessibilityRole="link"
          style={(state) => ({ borderWidth: 1.5, borderColor: (state as { hovered?: boolean }).hovered ? t.ink : t.chip, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 })}
        >
          <Txt size={12} weight="600" color={t.mut}>
            {tr('↔ recruiter mode')}
          </Txt>
        </Pressable>
      )}
      {langMenu}
      <IconCircle icon={rainOn ? '🎧' : '🎶'} bg={rainOn ? accent : t.chip} onPress={toggleRain} />
      <IconCircle icon={dark ? '☀️' : '🌙'} onPress={toggleDark} />
      {signedIn ? (
        <Pressable
          onPress={() => router.push('/profile' as never)}
          accessibilityRole="button"
          accessibilityLabel="profile"
          style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: isPlus ? accent : '#141519', alignItems: 'center', justifyContent: 'center' }}
        >
          <Txt size={13} weight="700" color={isPlus ? '#141519' : accent}>
            {avatarLetter}
          </Txt>
        </Pressable>
      ) : (
        <Chip label={tr('sign in')} size={13} px={14} py={8} bg="#141519" color="#F6F4EE" weight="700" onPress={() => router.push('/sign-in' as never)} />
      )}
    </View>
  );

  return (
    <View
      style={{
        position: bp.isDesktop ? ('sticky' as never) : 'relative',
        top: 0,
        zIndex: 10,
        backgroundColor: t.navbg,
        paddingTop: insets.top,
        ...(bp.isDesktop
          ? { height: 64, flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 44 }
          : { paddingHorizontal: 14, paddingVertical: 8, gap: 4 }),
      }}
    >
      {bp.isDesktop ? (
        <>
          <Logo onPress={() => router.push('/jobs' as never)} />
          <View style={{ flexDirection: 'row', gap: 4, marginLeft: 36, alignItems: 'center' }}>{navChips}</View>
          {rightCluster}
        </>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Logo onPress={() => router.push('/jobs' as never)} />
            {rightCluster}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, paddingBottom: 2 }}>
            {navChips}
            <Chip label={tr('↔ recruiter mode')} size={13.5} px={13} py={7} bg="transparent" color={t.mut} weight="500" onPress={() => router.push('/recruiter' as never)} />
          </ScrollView>
        </>
      )}
    </View>
  );
}
