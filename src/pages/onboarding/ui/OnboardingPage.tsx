import { useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Pressable, ScrollView, View, type ViewStyle } from 'react-native';
import { useAuth } from '@/entities/user';
import { obFormatDefs, obGradeDefs, obRoleDefs, useOnboardingFlags, useOnboardingStore, useSeekerPrefs } from '@/features/onboarding';
import { WORK_FORMATS, type Grade, type WorkFormat } from '@/shared/api';
import { LANGS } from '@/shared/i18n';
import { useLangStore, useT } from '@/shared/lib/useT';
import { useBreakpoint } from '@/shared/lib/responsive';
import { accent, accentInk, link, useTheme } from '@/shared/theme';
import { Card, Checkbox, Field, Txt } from '@/shared/ui';
import { CatMark, Highlight } from '@/pages/sign-in';

/** Onboarding pill: 9px 18px, radius 999, 14px; lime when on. */
function PillChip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={(s) => ({
        paddingVertical: 9,
        paddingHorizontal: 18,
        borderRadius: 999,
        backgroundColor: on ? accent : t.chip,
        opacity: (s as { hovered?: boolean }).hovered ? 0.85 : 1,
      })}
    >
      <Txt size={14} weight={on ? '600' : '500'} color={on ? accentInk : t.ink}>
        {label}
      </Txt>
    </Pressable>
  );
}

function StepHeader({ step, title, sub }: { step: number; title: string; sub: string }) {
  const t = useTheme();
  const tr = useT();
  return (
    <View style={{ gap: 5 }}>
      <Txt size={12} weight="600" color={t.mut2}>
        {tr('step')} {step} {tr('of')} 2
      </Txt>
      <Txt size={24} weight="700" ls={-0.02}>
        {title}
      </Txt>
      <Txt size={13.5} color={t.mut} lh={1.55}>
        {sub}
      </Txt>
    </View>
  );
}

/**
 * Local preference capture (no backend — the API has no seeker-preferences
 * endpoint). Choices land in `useSeekerPrefs`, which the jobs feed reads to
 * pre-fill JobSearchParams. Three steps, as in the design.
 */
export function OnboardingPage() {
  const t = useTheme();
  const tr = useT();
  const router = useRouter();
  const { isMobile } = useBreakpoint();
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);

  const { obStep, obConsent, ob, toggleConsent, next, back, pickRole, setRoleOther, pickGrade, toggleFormat, reset } = useOnboardingStore();
  const finishOnboarding = useOnboardingFlags((s) => s.finishOnboarding);
  const setPrefs = useSeekerPrefs((s) => s.set);
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);

  useEffect(() => () => reset(), [reset]);

  useEffect(() => {
    if (status === 'signedOut') router.replace('/sign-in' as never);
    else if (status === 'signedIn' && user?.user_type === 'b2b') router.replace('/recruiter' as never);
  }, [router, status, user?.user_type]);

  const finish = useCallback(
    (write: boolean) => {
      if (write) {
        setPrefs({
          grades: ob.grade ? [ob.grade] : [],
          workFormat: WORK_FORMATS.filter((f) => ob.format[f]),
          specializations: ob.role ? [ob.role] : [],
        });
      }
      finishOnboarding();
      router.replace('/jobs' as never);
    },
    [finishOnboarding, ob, router, setPrefs],
  );

  const ctaOn = obConsent;

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 24 }}>
      <View style={{ width: '100%', maxWidth: isMobile ? 460 : 560, gap: 16 }}>
        {obStep === 0 && (
          <View style={{ alignItems: 'center', gap: 18 }}>
            <CatMark size={52} />
            <View style={{ alignItems: 'center' }}>
              <Txt size={isMobile ? 29 : 42} weight="700" lh={1.08} ls={-0.04} align="center">
                {tr('dear newcomer,')}
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Txt size={isMobile ? 29 : 42} weight="700" lh={1.08} ls={-0.04} align="center">
                  {tr("welcome — we're")}
                </Txt>
                <Highlight size={isMobile ? 29 : 42} radius={10} px={12}>
                  {tr('on your side')}
                </Highlight>
              </View>
            </View>
            <Txt size={15} color={t.mut} lh={1.6} align="center" style={{ maxWidth: 440 }}>
              {tr('2 tiny questions so your feed makes sense from day one')}
            </Txt>
            <Card radius={18} padding={0} shadow={false} style={{ width: '100%', paddingVertical: 18, paddingHorizontal: 22, gap: 8 }}>
              <Txt size={13} weight="600" color={t.ink2}>
                {tr('✓ every posting comes straight from the job board — salary shown when the company lists it')}
              </Txt>
              <Txt size={13} weight="600" color={t.ink2}>
                {tr('✓ every application tracked in one calm place — statuses, cover letters, notes')}
              </Txt>
              <Txt size={13} weight="600" color={t.ink2}>
                {tr('✓ your cv, built once and reused everywhere')}
              </Txt>
            </Card>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6, rowGap: 8, maxWidth: 440 }}>
              <Txt size={12} color={t.mut2} style={{ marginRight: 4 }}>
                {tr('language:')}
              </Txt>
              {LANGS.map((l) => {
                const act = lang === l.code;
                return (
                  <Pressable
                    key={l.code}
                    onPress={() => setLang(l.code)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: act }}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 13,
                      borderRadius: 999,
                      backgroundColor: act ? '#141519' : 'transparent',
                      borderWidth: 1,
                      borderColor: act ? '#141519' : t.chip,
                    }}
                  >
                    <Txt size={12} weight="600" color={act ? accent : t.ink}>
                      {l.name}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>

            <Pressable onPress={toggleConsent} accessibilityRole="checkbox" accessibilityState={{ checked: obConsent }} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 9, maxWidth: 440 }}>
              <View style={{ marginTop: 1 }}>
                <Checkbox checked={obConsent} onPress={toggleConsent} variant="accent" />
              </View>
              <Txt size={12} color={t.mut} lh={1.5} style={{ flex: 1 }}>
                {tr('I agree to the')}{' '}
                <Txt size={12} weight="600" color={link}>
                  {tr('personal data policy')}
                </Txt>{' '}
                {tr('— we store your cv, contacts and applications only to make the product work, never sell them, and delete everything on request.')}
              </Txt>
            </Pressable>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Pressable
                onPress={ctaOn ? next : undefined}
                accessibilityRole="button"
                accessibilityState={{ disabled: !ctaOn }}
                style={(s) => ({
                  paddingVertical: 13,
                  paddingHorizontal: 28,
                  borderRadius: 13,
                  backgroundColor: ctaOn ? accent : t.chip,
                  opacity: (s as { hovered?: boolean }).hovered && ctaOn ? 0.9 : 1,
                  ...(ctaOn ? null : { cursor: 'default' }),
                }) as ViewStyle}
              >
                <Txt size={14} weight="700" color={ctaOn ? accentInk : t.mut2}>
                  {tr("let's set me up")}
                </Txt>
              </Pressable>
              <Pressable
                onPress={ctaOn ? () => finish(false) : undefined}
                accessibilityRole="button"
                accessibilityState={{ disabled: !ctaOn }}
                style={(s) => ({ paddingVertical: 13, paddingHorizontal: 14, opacity: !ctaOn ? 0.6 : (s as { hovered?: boolean }).hovered ? 1 : 0.9 })}
              >
                <Txt size={13.5} weight="600" color={t.mut}>
                  {tr('skip — just browsing')}
                </Txt>
              </Pressable>
            </View>
          </View>
        )}

        {obStep === 1 && (
          <Card radius={22} padding={28} gap={18}>
            <StepHeader step={1} title={tr('what do you do?')} sub={tr('roughly is fine — you can change everything later.')} />
            <View style={{ gap: 9 }}>
              <Txt size={12} weight="600" color={t.mut2}>
                {tr('your field')}
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                {obRoleDefs.map((r) => (
                  <PillChip key={r} label={tr(r)} on={ob.role === r && !ob.roleOther.trim()} onPress={() => pickRole(r)} />
                ))}
              </View>
              <Field
                value={ob.roleOther}
                onChangeText={setRoleOther}
                placeholder={tr('something else? just type it — every field counts')}
                bg={t.bg}
                size={13.5}
                radius={11}
                borderColor={ob.roleOther.trim() ? accent : 'transparent'}
                style={{ paddingHorizontal: 15, paddingVertical: 11, borderWidth: 1.5 }}
              />
            </View>
            <View style={{ gap: 9 }}>
              <Txt size={12} weight="600" color={t.mut2}>
                {tr('your level — pick one, roughly')}
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                {obGradeDefs.map((g) => (
                  <PillChip key={g.key} label={tr(g.label)} on={ob.grade === g.key} onPress={() => pickGrade(g.key as Grade)} />
                ))}
              </View>
            </View>
          </Card>
        )}

        {obStep === 2 && (
          <Card radius={22} padding={28} gap={18}>
            <StepHeader step={2} title={tr('how do you want to work?')} sub={tr("you're allowed to be picky — that's what filters are for.")} />
            <View style={{ gap: 9 }}>
              <Txt size={12} weight="600" color={t.mut2}>
                {tr('work format')}
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                {obFormatDefs.map((f) => (
                  <PillChip key={f.key} label={tr(f.label)} on={!!ob.format[f.key]} onPress={() => toggleFormat(f.key as WorkFormat)} />
                ))}
              </View>
            </View>
            <Txt size={12.5} color={t.mut2} lh={1.5}>
              {tr('salary, visa, language and the rest live in the filters — set them whenever.')}
            </Txt>
          </Card>
        )}

        {obStep > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable onPress={back} accessibilityRole="button" style={(s) => ({ opacity: (s as { hovered?: boolean }).hovered ? 0.75 : 1 })}>
              <Txt size={13} weight="600" color={t.mut}>
                {tr('← back')}
              </Txt>
            </Pressable>
            <Pressable
              onPress={obStep === 1 ? next : () => finish(true)}
              accessibilityRole="button"
              style={(s) => ({
                marginLeft: 'auto',
                paddingVertical: 12,
                paddingHorizontal: 28,
                borderRadius: 13,
                backgroundColor: accent,
                opacity: (s as { hovered?: boolean }).hovered ? 0.9 : 1,
              })}
            >
              <Txt size={14} weight="700" color={accentInk}>
                {obStep === 1 ? tr('next') : tr('show me my feed →')}
              </Txt>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
