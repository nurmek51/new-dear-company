import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { authApi, useAuth } from '@/entities/user';
import { ApiError } from '@/shared/api';
import { useT } from '@/shared/lib/useT';
import { link, useTheme } from '@/shared/theme';
import { Txt } from '@/shared/ui';
import { AuthCanvas, AuthCta, AuthField, CatMark, ErrorLine, Highlight, TextLink } from './AuthBits';
import { GoogleButton, googleSignInAvailable } from './GoogleButton';

type Mode = 'signin' | 'register' | 'sent' | 'reset';

const hasAt = (email: string) => email.indexOf('@') > 0;

export function SignInPage() {
  const t = useTheme();
  const tr = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const recruiter = params.mode === 'recruiter';

  const submitting = useAuth((s) => s.submitting);
  const authError = useAuth((s) => s.error);
  const clearError = useAuth((s) => s.clearError);
  const signIn = useAuth((s) => s.signIn);
  const register = useAuth((s) => s.register);
  const signInGoogle = useAuth((s) => s.signInGoogle);

  const [mode, setModeRaw] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [name, setName] = useState('');
  const [pass2, setPass2] = useState('');
  const [orgName, setOrgName] = useState('');
  const [designation, setDesignation] = useState('');
  const [orgEmail, setOrgEmail] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setMode = useCallback(
    (m: Mode) => {
      setModeRaw(m);
      setLocalError(null);
      setNotice(null);
      clearError();
    },
    [clearError],
  );

  useEffect(() => () => clearError(), [clearError]);

  const goHome = useCallback(() => router.replace('/' as never), [router]);
  const offline = tr('could not reach the server. check your connection and try again.');
  const failMsg = useCallback(
    (e: unknown, fallback: string) => (e instanceof ApiError ? (e.isNetworkError ? offline : e.message) : fallback),
    [offline],
  );

  const b2bOk = !recruiter || (orgName.trim() && designation.trim() && hasAt(orgEmail));
  const registerReady = !!name.trim() && hasAt(email) && pass.length >= 8 && pass2.length > 0 && !!b2bOk;
  const signInReady = hasAt(email) && pass.length > 0;

  const doSignIn = useCallback(async () => {
    if (!signInReady || submitting) return;
    const ok = await signIn(email.trim(), pass);
    if (ok) goHome();
  }, [email, goHome, pass, signIn, signInReady, submitting]);

  const doRegister = useCallback(async () => {
    if (submitting) return;
    if (pass !== pass2) {
      setLocalError(tr('the two passwords do not match.'));
      return;
    }
    if (!registerReady) return;
    setLocalError(null);
    const ok = await register({
      email: email.trim(),
      password1: pass,
      password2: pass2,
      name: name.trim(),
      user_type: recruiter ? 'b2b' : 'b2c',
      ...(recruiter ? { organization_name: orgName.trim(), designation: designation.trim(), organization_email: orgEmail.trim() } : null),
    });
    if (ok) setMode('sent');
  }, [designation, email, name, orgEmail, orgName, pass, pass2, recruiter, register, registerReady, setMode, submitting, tr]);

  const doResend = useCallback(async () => {
    if (busy || !hasAt(email)) return;
    setBusy(true);
    setLocalError(null);
    try {
      await authApi.resendVerification(email.trim());
      setNotice(tr('verification e-mail sent again.'));
    } catch (e) {
      setLocalError(failMsg(e, tr('could not resend. please try again.')));
    } finally {
      setBusy(false);
    }
  }, [busy, email, failMsg, tr]);

  const doReset = useCallback(async () => {
    if (busy || !hasAt(email)) return;
    setBusy(true);
    setLocalError(null);
    try {
      await authApi.requestPasswordReset(email.trim());
      // spec §1.10: always 200 (enumeration-safe) — show the server's own wording
      setNotice(tr('password reset e-mail has been sent (if an account exists for this address).'));
    } catch (e) {
      setLocalError(failMsg(e, tr('could not request a reset. please try again.')));
    } finally {
      setBusy(false);
    }
  }, [busy, email, failMsg, tr]);

  const onGoogleToken = useCallback(
    async (idToken: string) => {
      const ok = await signInGoogle(idToken);
      if (ok) goHome();
    },
    [goHome, signInGoogle],
  );

  const error = localError ?? authError;
  const showFields = mode !== 'sent';

  return (
    <AuthCanvas>
      {/* logo row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <CatMark size={26} />
        <Txt size={16} weight="700" ls={-0.02}>
          {tr('dear company')}
          <Txt size={16} weight="700" color={link}>
            ,
          </Txt>
        </Txt>
      </View>

      {/* heading */}
      <View>
        {mode === 'register' ? (
          <>
            <Txt size={28} weight="700" ls={-0.03} lh={1.15}>
              {recruiter ? tr('hiring for a team?') : tr('new here?')}
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Txt size={28} weight="700" ls={-0.03} lh={1.15}>
                {tr("let's get you")}
              </Txt>
              <Highlight size={28}>{tr('started')}</Highlight>
            </View>
          </>
        ) : mode === 'reset' ? (
          <>
            <Txt size={28} weight="700" ls={-0.03} lh={1.15}>
              {tr('forgot it?')}
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Txt size={28} weight="700" ls={-0.03} lh={1.15}>
                {tr('happens to the')}
              </Txt>
              <Highlight size={28}>{tr('best')}</Highlight>
            </View>
          </>
        ) : mode === 'sent' ? (
          <>
            <Txt size={28} weight="700" ls={-0.03} lh={1.15}>
              {tr('one more step —')}
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Txt size={28} weight="700" ls={-0.03} lh={1.15}>
                {tr('check your')}
              </Txt>
              <Highlight size={28}>{tr('inbox')}</Highlight>
            </View>
          </>
        ) : (
          <>
            <Txt size={28} weight="700" ls={-0.03} lh={1.15}>
              {tr("hi. let's find you")}
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Txt size={28} weight="700" ls={-0.03} lh={1.15}>
                {recruiter ? tr('someone') : tr('something')}
              </Txt>
              <Highlight size={28}>{tr('good')}</Highlight>
            </View>
          </>
        )}
        <Txt size={13} color={t.mut} style={{ marginTop: 6 }} lh={1.5}>
          {mode === 'sent'
            ? tr('we sent a verification link to') + ' ' + email.trim() + '. ' + tr('open it, then sign in.')
            : mode === 'reset'
              ? tr('enter your email and we’ll send a reset link if an account exists.')
              : tr('one account for everything — job hunting here, hiring in recruiter mode. no separate logins, ever.')}
        </Txt>
      </View>

      {/* form */}
      <View style={{ gap: 10 }}>
        {mode === 'register' && <AuthField value={name} onChangeText={setName} placeholder={tr('your name')} />}
        {showFields && <AuthField value={email} onChangeText={setEmail} placeholder={tr('email')} />}
        {(mode === 'signin' || mode === 'register') && (
          <AuthField value={pass} onChangeText={setPass} placeholder={mode === 'register' ? tr('password (8+ characters)') : tr('password')} secure onSubmitEditing={mode === 'signin' ? doSignIn : undefined} />
        )}
        {mode === 'register' && (
          <AuthField value={pass2} onChangeText={setPass2} placeholder={tr('repeat password')} secure invalid={pass2.length > 0 && pass2 !== pass} onSubmitEditing={doRegister} />
        )}
        {mode === 'register' && recruiter && (
          <>
            <Txt size={12} weight="600" color={t.mut2} style={{ marginTop: 4 }}>
              {tr('your company')}
            </Txt>
            <AuthField value={orgName} onChangeText={setOrgName} placeholder={tr('organization name')} />
            <AuthField value={designation} onChangeText={setDesignation} placeholder={tr('your role there (e.g. hr manager)')} />
            <AuthField value={orgEmail} onChangeText={setOrgEmail} placeholder={tr('organization email')} />
          </>
        )}

        <ErrorLine text={error} />
        {notice ? (
          <Txt size={12} weight="600" color={t.green} lh={1.5} accessibilityLiveRegion="polite">
            {notice}
          </Txt>
        ) : null}

        {mode === 'signin' && <AuthCta label={submitting ? tr('signing in…') : tr('continue →')} enabled={signInReady} busy={submitting} onPress={doSignIn} />}
        {mode === 'register' && <AuthCta label={submitting ? tr('creating…') : tr('create account →')} enabled={registerReady} busy={submitting} onPress={doRegister} />}
        {mode === 'reset' && <AuthCta label={busy ? tr('sending…') : tr('send reset link →')} enabled={hasAt(email)} busy={busy} onPress={doReset} />}
        {mode === 'sent' && (
          <>
            <AuthCta label={tr('I have the key — verify')} enabled onPress={() => router.push('/verify-email' as never)} />
            <AuthCta label={busy ? tr('sending…') : tr('resend the e-mail')} enabled={!busy} busy={busy} onPress={doResend} />
          </>
        )}

        {mode === 'signin' && googleSignInAvailable && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: t.chip }} />
              <Txt size={11.5} color={t.mut2}>
                {tr('or')}
              </Txt>
              <View style={{ flex: 1, height: 1, backgroundColor: t.chip }} />
            </View>
            <GoogleButton onIdToken={onGoogleToken} onError={setLocalError} disabled={submitting} />
          </>
        )}
      </View>

      {/* footer */}
      <View style={{ gap: 6 }}>
        {mode === 'signin' && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
            <Txt size={11.5} color={t.mut2} lh={1.5}>
              {tr('new here?')}
            </Txt>
            <TextLink label={tr('create an account')} onPress={() => setMode('register')} />
            <Txt size={11.5} color={t.mut2} lh={1.5}>
              ·
            </Txt>
            <TextLink label={tr('forgot password?')} onPress={() => setMode('reset')} />
          </View>
        )}
        {mode !== 'signin' && <TextLink label={tr('← back to sign in')} onPress={() => setMode('signin')} />}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          <Txt size={11.5} color={t.mut2} lh={1.5}>
            {recruiter ? tr('looking for a job instead?') : tr('hiring for a team?')}
          </Txt>
          <TextLink
            label={recruiter ? tr('seeker mode') : tr('recruiter mode')}
            onPress={() => {
              setMode('signin');
              router.replace((recruiter ? '/sign-in' : '/sign-in?mode=recruiter') as never);
            }}
          />
          <Txt size={11.5} color={t.mut2} lh={1.5}>
            {tr('uses the same account.')}
          </Txt>
        </View>
      </View>
    </AuthCanvas>
  );
}
