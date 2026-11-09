import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, TextInput, View, type TextStyle, type ViewStyle } from 'react-native';
import { authApi, isRecruiter, useAuth } from '@/entities/user';
import { ApiError } from '@/shared/api';
import { useBreakpoint } from '@/shared/lib/responsive';
import { useT } from '@/shared/lib/useT';
import { accent, font, link, useTheme } from '@/shared/theme';
import { Txt } from '@/shared/ui';
import { ScreenScrollView } from '@/shared/ui/ScreenScrollView';

/**
 * Recruiter registration (Recruiter ATS prototype 192–224 "let's set up your
 * workspace") wired to POST /api/v1/auth/registration/ with user_type=b2b
 * (spec §1.1). Signed-in users attach a recruiter profile to their account
 * via POST /api/v1/accounts/recruiter-profile/ (BACKEND_DUAL_PROFILE_PROMPT.md).
 * New registrations are followed by the work-email verification screen (152–190)
 * adapted to the real contract: the backend sends a confirmation LINK, so
 * the six-digit code boxes are gone; resend hits §1.3.
 */
type Step = 'form' | 'verify';

const hasAt = (s: string) => s.indexOf('@') > 0;
const PERSONAL = /@(gmail|yahoo|outlook|hotmail|mail|yandex|icloud)\./i;

function Label({ text }: { text: string }) {
  const t = useTheme();
  return (
    <Txt size={11.5} weight="600" color={t.mut}>
      {text}
    </Txt>
  );
}

/** design 199–203: border 1 l15, radius 10, padding 11 14, 13.5px, bg hov */
function Input(props: { value: string; onChangeText: (v: string) => void; placeholder: string; secure?: boolean; invalid?: boolean; label: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Label text={props.label} />
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={t.mut2}
        secureTextEntry={props.secure}
        autoCapitalize="none"
        accessibilityLabel={props.label}
        style={{
          borderWidth: 1,
          borderColor: props.invalid ? '#b91c1c' : t.l15,
          borderRadius: 10,
          paddingVertical: 11,
          paddingHorizontal: 14,
          fontSize: 13.5,
          backgroundColor: t.hov,
          fontFamily: font.regular,
          color: t.ink,
          outlineStyle: 'none',
        } as unknown as TextStyle}
      />
    </View>
  );
}

function ErrorBox({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <View style={{ backgroundColor: '#FDE2E2', borderRadius: 11, paddingVertical: 11, paddingHorizontal: 14 }} accessibilityLiveRegion="polite">
      <Txt size={12.5} weight="600" color="#b91c1c">
        {text}
      </Txt>
    </View>
  );
}

export function RecruiterOnboardingPage() {
  const t = useTheme();
  const tr = useT();
  const bp = useBreakpoint();
  const router = useRouter();
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  const submitting = useAuth((s) => s.submitting);
  const authError = useAuth((s) => s.error);
  const clearError = useAuth((s) => s.clearError);
  const register = useAuth((s) => s.register);
  const setUser = useAuth((s) => s.setUser);
  const connecting = status === 'signedIn';
  const [connectingBusy, setConnectingBusy] = useState(false);

  const [step, setStep] = useState<Step>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [orgName, setOrgName] = useState('');
  const [designation, setDesignation] = useState('');
  const [orgEmail, setOrgEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // verify step
  const [resendIn, setResendIn] = useState(0);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendNote, setResendNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { clearError(); if (timer.current) clearInterval(timer.current); }, [clearError]);

  const passMismatch = pass2.length > 0 && pass !== pass2;
  const ready =
    (connecting || (!!name.trim() && hasAt(email) && pass.length >= 8 && pass2.length > 0 && !passMismatch)) &&
    !!orgName.trim() && !!designation.trim() && hasAt(orgEmail) && consent;
  const busy = submitting || connectingBusy;

  const submit = useCallback(async () => {
    if (!ready || busy) return;
    setLocalError(null);
    if (connecting) {
      setConnectingBusy(true);
      try {
        const updated = await authApi.createRecruiterProfile({
          organization_name: orgName.trim(),
          designation: designation.trim(),
          organization_email: orgEmail.trim(),
        });
        if (!isRecruiter(updated)) throw new Error('Missing recruiter profile');
        setUser(updated);
        router.replace('/recruiter' as never);
      } catch (e) {
        setLocalError(e instanceof ApiError
          ? e.status === 404 || e.status === 405
            ? tr('recruiter setup is temporarily unavailable. please try again later.')
            : e.isNetworkError
              ? tr('could not reach the server. check your connection and retry.')
              : e.message
          : tr('could not connect your recruiter profile. please try again.'));
      } finally {
        setConnectingBusy(false);
      }
      return;
    }
    const ok = await register({
      email: email.trim(),
      password1: pass,
      password2: pass2,
      name: name.trim(),
      user_type: 'b2b',
      organization_name: orgName.trim(),
      designation: designation.trim(),
      organization_email: orgEmail.trim(),
    });
    if (ok) setStep('verify');
  }, [ready, busy, connecting, register, email, pass, pass2, name, orgName, designation, orgEmail, setUser, router, tr]);

  const startCooldown = () => {
    setResendIn(30);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setResendIn((n) => {
        if (n <= 1) { if (timer.current) clearInterval(timer.current); return 0; }
        return n - 1;
      });
    }, 1000);
  };

  const resend = useCallback(async () => {
    if (resendIn || resendBusy) return;
    setResendBusy(true);
    setResendNote(null);
    try {
      await authApi.resendVerification(email.trim());
      setResendNote(tr('sent — check your inbox again.'));
      startCooldown();
    } catch (e) {
      setResendNote(
        e instanceof ApiError
          ? e.isNetworkError
            ? tr('could not reach the server. check your connection and retry.')
            : e.message
          : tr('could not resend. please try again.'),
      );
    } finally {
      setResendBusy(false);
    }
  }, [resendIn, resendBusy, email, tr]);

  if (status === 'signedIn' && isRecruiter(user)) return <Redirect href={'/recruiter' as never} />;

  const canvas = (w: number, children: ReactNode) => (
    <ScreenScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: bp.isMobile ? 16 : 24, paddingVertical: 30 }}>
      <View style={{ width: '100%', maxWidth: w, gap: 16 }}>{children}</View>
    </ScreenScrollView>
  );

  if (step === 'verify') {
    const personal = PERSONAL.test(email);
    return canvas(430, (
      <>
        <Txt size={bp.isMobile ? 22 : 26} weight="700" ls={-0.03}>{tr('verify your work email')}</Txt>
        <Txt size={13} color={t.mut} lh={1.6}>
          {tr('candidates see which company writes to them, so we check that')} <Txt size={13} weight="700" color={t.mut}>{email.trim()}</Txt> {tr('really is yours. we sent a confirmation link — open it, then sign in.')}
        </Txt>
        {personal && (
          <View style={{ backgroundColor: '#FFF3C4', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 15, gap: 5 }}>
            <Txt size={12.5} weight="700" color="#92400e">{tr('that looks like a personal address')}</Txt>
            <Txt size={12} color="#92400e" lh={1.5}>{tr("gmail, yahoo and friends can't prove you work at a company. candidates will see your organization email instead.")}</Txt>
          </View>
        )}
        {resendNote && (
          <Txt size={12.5} weight="600" color={t.mut} accessibilityLiveRegion="polite">{resendNote}</Txt>
        )}
        <Pressable
          onPress={() => router.replace('/sign-in?mode=recruiter' as never)}
          accessibilityRole="button"
          style={{ alignItems: 'center', paddingVertical: 12, borderRadius: 11, backgroundColor: '#141519' }}
        >
          <Txt size={14} weight="700" color={accent}>{tr("I've verified → sign in")}</Txt>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Pressable onPress={resend} disabled={!!resendIn || resendBusy} accessibilityRole="button" accessibilityState={{ disabled: !!resendIn || resendBusy }}>
            <Txt size={12.5} weight="600" color={resendIn || resendBusy ? t.mut2 : link}>
              {resendBusy ? tr('sending…') : resendIn ? `${tr('resend in')} ${resendIn}s` : tr('resend the link')}
            </Txt>
          </Pressable>
          <Txt size={12.5} color={t.mut2}>·</Txt>
          <Pressable onPress={() => { setStep('form'); setResendNote(null); }} accessibilityRole="button">
            <Txt size={12.5} weight="600" color={link}>{tr('use a different address')}</Txt>
          </Pressable>
        </View>
      </>
    ));
  }

  const ctaOn = ready && !busy;
  return canvas(500, (
    <>
      <View>
        <Txt size={bp.isMobile ? 22 : 28} weight="700" ls={-0.03}>{tr("let's set up your workspace")}</Txt>
        <Txt size={13} color={t.mut} style={{ marginTop: 4 }}>{connecting ? tr('add your company details to hire with your existing account. your job seeker profile stays available.') : tr('your details and your organization. everything except the email is changeable later.')}</Txt>
      </View>
      <View style={{ backgroundColor: t.card, borderWidth: 1, borderColor: t.l10, borderRadius: 16, paddingVertical: 20, paddingHorizontal: 22, gap: 16 }}>
        {!connecting && (
          <>
            <Input label={tr('your name *')} value={name} onChangeText={setName} placeholder={tr('e.g. anna novak')} />
            <Input label={tr('work email *')} value={email} onChangeText={setEmail} placeholder={tr('you@company.com')} invalid={email.length > 0 && !hasAt(email)} />
            <Input label={tr('password * (8+ characters)')} value={pass} onChangeText={setPass} placeholder={tr('password')} secure invalid={pass.length > 0 && pass.length < 8} />
            <Input label={tr('repeat password *')} value={pass2} onChangeText={setPass2} placeholder={tr('repeat password')} secure invalid={passMismatch} />
            {passMismatch && <Txt size={12} weight="600" color="#b91c1c">{tr('passwords do not match')}</Txt>}
            <View style={{ height: 1, backgroundColor: t.l08 }} />
          </>
        )}
        <Input label={tr('company name *')} value={orgName} onChangeText={setOrgName} placeholder={tr('e.g. dear company')} />
        <Input label={tr('your role at the company *')} value={designation} onChangeText={setDesignation} placeholder={tr('e.g. hr manager')} />
        <Input label={tr('organization email *')} value={orgEmail} onChangeText={setOrgEmail} placeholder={tr('hr@company.com')} invalid={orgEmail.length > 0 && !hasAt(orgEmail)} />
      </View>
      <Pressable onPress={() => setConsent((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: consent }} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ width: 20, height: 20, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: consent ? accent : t.card, borderWidth: 1.5, borderColor: consent ? accent : t.l25 }}>
          {consent ? <Txt size={12} color="#101114">✓</Txt> : null}
        </View>
        <Txt size={12.5} color={t.ink2} lh={1.5} style={{ flex: 1 }}>
          {tr('I agree to the data processing policy and confirm my company has a lawful basis to store candidate data.')}
        </Txt>
      </Pressable>
      <ErrorBox text={localError ?? authError} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Pressable
          onPress={ctaOn ? submit : undefined}
          accessibilityRole="button"
          accessibilityState={{ disabled: !ctaOn, busy }}
          style={{ paddingVertical: 12, paddingHorizontal: 24, borderRadius: 11, backgroundColor: ctaOn ? '#141519' : t.chip, ...(ctaOn ? null : { cursor: 'default' }) } as ViewStyle}
        >
          <Txt size={13.5} weight="700" color={ctaOn ? '#F6F4EE' : t.mut2}>{busy ? tr('creating…') : connecting ? tr('connect recruiter profile →') : tr('create workspace →')}</Txt>
        </Pressable>
        <Pressable onPress={() => router.push((connecting ? '/jobs' : '/sign-in?mode=recruiter') as never)} accessibilityRole="link">
          <Txt size={13} weight="600" color={t.mut}>{connecting ? tr('back to jobs') : tr('already registered? sign in')}</Txt>
        </Pressable>
      </View>
      {!connecting && <Txt size={11.5} color={t.mut2} lh={1.5}>{tr('after registering you will receive a confirmation link by email; sign-in works once the address is verified.')}</Txt>}
    </>
  ));
}
