import { router, usePathname } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/entities/user';
import { useTipsStore } from '@/features/tips';
import { LANGS } from '@/shared/i18n';
import { useBreakpoint } from '@/shared/lib/responsive';
import { useLangStore, useT } from '@/shared/lib/useT';
import { accent, useTheme, useThemeStore } from '@/shared/theme';
import { Txt } from '@/shared/ui';

/**
 * Recruiter top bar (Recruiter ATS prototype lines 53–110). Hidden from the
 * design: schedule (interview scheduling is broken server-side, spec §11.1),
 * team (invitations not itemized in the spec), archive and admin console
 * (no endpoints). Kept: overview, jobs, candidates, reports, + new job,
 * plan & pricing, switch to seeker mode, tips, sign out.
 */
const navDefs = [
  { key: 'recruiter', label: 'overview', href: '/recruiter' },
  { key: 'jobs', label: 'jobs', href: '/recruiter/jobs' },
  { key: 'candidates', label: 'candidates', href: '/recruiter/candidates' },
  { key: 'reports', label: 'reports', href: '/recruiter/reports' },
];

function CatMark() {
  return (
    <View style={{ position: 'relative', width: 20, height: 17 }}>
      <View style={{ position: 'absolute', bottom: 0, width: 20, height: 13, backgroundColor: accent, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderBottomLeftRadius: 7, borderBottomRightRadius: 7 }} />
      <View style={{ position: 'absolute', top: 0, left: 2, width: 0, height: 0, borderLeftWidth: 4, borderRightWidth: 4, borderBottomWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: accent }} />
      <View style={{ position: 'absolute', top: 0, right: 2, width: 0, height: 0, borderLeftWidth: 4, borderRightWidth: 4, borderBottomWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: accent }} />
      <View style={{ position: 'absolute', bottom: 4, left: 5, width: 2.5, height: 2.5, borderRadius: 2, backgroundColor: '#141519' }} />
      <View style={{ position: 'absolute', bottom: 4, right: 5, width: 2.5, height: 2.5, borderRadius: 2, backgroundColor: '#141519' }} />
    </View>
  );
}

export function RecruiterTopBar() {
  const t = useTheme();
  const bp = useBreakpoint();
  const tr = useT();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const dark = useThemeStore((s) => s.dark);
  const toggleDark = useThemeStore((s) => s.toggleDark);
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const restartTips = useTipsStore((s) => s.restartTips);
  const [langOpen, setLangOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const seg = pathname.replace(/^\/recruiter\/?/, '').split('/')[0];
  const activeKey = seg === '' ? 'recruiter' : seg === 'job' ? 'jobs' : seg;
  const initials = (user?.name ?? 'me')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toLowerCase();
  const planBadge = user?.subscription?.package?.name?.toLowerCase() ?? 'starter';

  const navItems = navDefs.map((n) => {
    const on = n.key === activeKey;
    return (
      <Pressable
        key={n.key}
        onPress={() => router.push(n.href as never)}
        style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: on ? 'rgba(246,244,238,0.12)' : 'transparent' }}
      >
        <Txt size={12.5} weight="500" color={on ? '#F6F4EE' : '#a1a1aa'} style={{ whiteSpace: 'nowrap' } as never}>
          {tr(n.label)}
        </Txt>
      </Pressable>
    );
  });

  const rightCluster = (
    <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable
        onPress={() => router.push('/recruiter/new-job' as never)}
        style={(state) => ({ backgroundColor: (state as { hovered?: boolean }).hovered ? '#c5f96a' : accent, paddingVertical: 7, paddingHorizontal: 14, borderRadius: 8 })}
      >
        <Txt size={12.5} weight="600" color="#101114">
          {tr('+ new job')}
        </Txt>
      </Pressable>
      <View style={{ position: 'relative' }}>
        <Pressable onPress={() => { setLangOpen((v) => !v); setMenuOpen(false); }} style={{ height: 32, borderRadius: 999, backgroundColor: 'rgba(246,244,238,0.12)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9 }}>
          <Txt size={10.5} weight="700" mono color="#F6F4EE">
            {lang.toUpperCase()} ▾
          </Txt>
        </Pressable>
        {langOpen && (
          <View style={{ position: 'absolute', top: 38, right: 0, backgroundColor: t.card, borderWidth: 1, borderColor: t.l12, borderRadius: 13, padding: 6, gap: 2, zIndex: 96, minWidth: 150, shadowColor: '#141519', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.2, shadowRadius: 36, elevation: 12 }}>
            {LANGS.map((lo) => {
              const on = lo.code === lang;
              return (
                <Pressable key={lo.code} onPress={() => { setLang(lo.code); setLangOpen(false); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 11, borderRadius: 9, backgroundColor: on ? '#141519' : 'transparent' }}>
                  <Txt size={10} mono color={on ? accent : t.ink} style={{ opacity: 0.6 }}>{lo.code.toUpperCase()}</Txt>
                  <Txt size={13} weight="600" color={on ? accent : t.ink}>{lo.name}</Txt>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
      <Pressable onPress={toggleDark} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(246,244,238,0.12)', alignItems: 'center', justifyContent: 'center' }}>
        <Txt size={14}>{dark ? '☀️' : '🌙'}</Txt>
      </Pressable>
      <View style={{ position: 'relative' }}>
        <Pressable
          onPress={() => { setMenuOpen((v) => !v); setLangOpen(false); }}
          style={(state) => ({ width: 32, height: 32, borderRadius: 16, backgroundColor: '#DBE7FC', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: (state as { hovered?: boolean }).hovered ? accent : 'transparent' })}
        >
          <Txt size={12} weight="700" color="#1e40af">{initials}</Txt>
        </Pressable>
        {menuOpen && (
          <View style={{ position: 'absolute', top: 42, right: 0, width: 240, backgroundColor: t.card, borderRadius: 12, padding: 8, zIndex: 60, shadowColor: '#141519', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.28, shadowRadius: 32, elevation: 12 }}>
            <View style={{ paddingVertical: 8, paddingHorizontal: 10 }}>
              <Txt size={13} weight="700">{user?.name ?? ''}</Txt>
              <Txt size={11.5} color={t.mut}>{tr('recruiter')}{user?.email ? ` · ${user.email}` : ''}</Txt>
            </View>
            <View style={{ height: 1, backgroundColor: t.l08, marginVertical: 4 }} />
            {[
              { label: '↔ switch to job seeker mode', onPress: () => router.push('/jobs' as never) },
              { label: 'plan & pricing', onPress: () => router.push('/recruiter/pricing' as never), badge: planBadge },
              { label: 'show tips again', onPress: () => { restartTips(); setMenuOpen(false); } },
            ].map((item) => (
              <Pressable key={item.label} onPress={() => { setMenuOpen(false); item.onPress(); }} style={(state) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 8, backgroundColor: (state as { hovered?: boolean }).hovered ? t.bg : 'transparent' })}>
                <Txt size={13} weight="600">{tr(item.label)}</Txt>
                {item.badge ? (
                  <View style={{ marginLeft: 'auto', backgroundColor: accent, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Txt size={10} weight="700" color="#101114">{item.badge}</Txt>
                  </View>
                ) : null}
              </Pressable>
            ))}
            <View style={{ height: 1, backgroundColor: t.l08, marginVertical: 4 }} />
            <Pressable onPress={async () => { setMenuOpen(false); await signOut(); router.replace('/sign-in' as never); }} style={(state) => ({ paddingVertical: 9, paddingHorizontal: 10, borderRadius: 8, backgroundColor: (state as { hovered?: boolean }).hovered ? t.hov : 'transparent' })}>
              <Txt size={13} weight="600" color={t.mut}>{tr('sign out')}</Txt>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={{ backgroundColor: '#141519', paddingTop: insets.top, zIndex: 20, ...(bp.isDesktop ? { height: 54, flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 26 } : { paddingHorizontal: 12, paddingVertical: 8, gap: 6 }) }}>
      {bp.isDesktop ? (
        <>
          <Pressable onPress={() => router.push('/recruiter' as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <CatMark />
            <Txt size={14} weight="700" color="#F6F4EE" ls={-0.02}>dear company</Txt>
            <View style={{ borderWidth: 1, borderColor: 'rgba(179,242,66,0.4)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
              <Txt size={10} mono color={accent}>{tr('recruiter')}</Txt>
            </View>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 1, marginLeft: 22 }}>{navItems}</View>
          {rightCluster}
        </>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable onPress={() => router.push('/recruiter' as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <CatMark />
              <Txt size={14} weight="700" color="#F6F4EE" ls={-0.02}>dear company</Txt>
            </Pressable>
            {rightCluster}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 1 }}>{navItems}</ScrollView>
        </>
      )}
    </View>
  );
}
