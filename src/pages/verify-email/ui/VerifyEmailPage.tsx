import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { authApi } from '@/entities/user';
import { ApiError } from '@/shared/api';
import { useT } from '@/shared/lib/useT';
import { link, useTheme } from '@/shared/theme';
import { Txt } from '@/shared/ui';
import { AuthCanvas, AuthCta, AuthField, CatMark, ErrorLine, Highlight, TextLink } from '@/pages/sign-in';

type Phase = 'idle' | 'verifying' | 'done' | 'failed';

/** /verify-email?key=… → POST /api/v1/auth/registration/verify-email/ (spec §1.2). */
export function VerifyEmailPage() {
  const t = useTheme();
  const tr = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ key?: string | string[] }>();
  const urlKey = Array.isArray(params.key) ? params.key[0] : params.key;

  const [key, setKey] = useState(urlKey ?? '');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [resendBusy, setResendBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const autoTried = useRef(false);

  const verify = useCallback(
    async (k: string) => {
      const value = k.trim();
      if (!value || phase === 'verifying') return;
      setError(null);
      setNotice(null);
      setPhase('verifying');
      try {
        await authApi.verifyEmail(value);
        setPhase('done');
      } catch (e) {
        setPhase('failed');
        setError(
          e instanceof ApiError
            ? e.isNetworkError
              ? tr('could not reach the server. check your connection and try again.')
              : e.message
            : tr('could not verify this key. it may have expired.'),
        );
      }
    },
    [phase, tr],
  );

  // auto-verify once when the key arrives in the URL
  useEffect(() => {
    if (urlKey && !autoTried.current) {
      autoTried.current = true;
      void verify(urlKey);
    }
  }, [urlKey, verify]);

  const resend = useCallback(async () => {
    if (resendBusy || email.indexOf('@') <= 0) return;
    setResendBusy(true);
    setError(null);
    setNotice(null);
    try {
      await authApi.resendVerification(email.trim());
      setNotice(tr('verification e-mail sent again.'));
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.isNetworkError
            ? tr('could not reach the server. check your connection and try again.')
            : e.message
          : tr('could not resend. please try again.'),
      );
    } finally {
      setResendBusy(false);
    }
  }, [email, resendBusy, tr]);

  return (
    <AuthCanvas>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <CatMark size={26} />
        <Txt size={16} weight="700" ls={-0.02}>
          {tr('dear company')}
          <Txt size={16} weight="700" color={link}>
            ,
          </Txt>
        </Txt>
      </View>

      <View>
        {phase === 'done' ? (
          <>
            <Txt size={28} weight="700" ls={-0.03} lh={1.15}>
              {tr('verified.')}
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Txt size={28} weight="700" ls={-0.03} lh={1.15}>
                {tr("you're")}
              </Txt>
              <Highlight size={28}>{tr('in')}</Highlight>
            </View>
            <Txt size={13} color={t.mut} style={{ marginTop: 6 }} lh={1.5}>
              {tr('your e-mail is confirmed. sign in with your password to continue.')}
            </Txt>
          </>
        ) : (
          <>
            <Txt size={28} weight="700" ls={-0.03} lh={1.15}>
              {tr('confirm your')}
            </Txt>
            <Highlight size={28}>{tr('e-mail')}</Highlight>
            <Txt size={13} color={t.mut} style={{ marginTop: 6 }} lh={1.5}>
              {phase === 'verifying'
                ? tr('checking your key…')
                : urlKey
                  ? tr('we are verifying the key from your link.')
                  : tr('open the link we e-mailed you — or paste the key from that link here.')}
            </Txt>
          </>
        )}
      </View>

      <View style={{ gap: 10 }}>
        {phase === 'done' ? (
          <AuthCta label={tr('sign in →')} enabled onPress={() => router.replace('/sign-in' as never)} />
        ) : (
          <>
            <AuthField value={key} onChangeText={setKey} placeholder={tr('verification key')} onSubmitEditing={() => verify(key)} />
            <ErrorLine text={error} />
            <AuthCta label={phase === 'verifying' ? tr('verifying…') : tr('verify →')} enabled={!!key.trim()} busy={phase === 'verifying'} onPress={() => verify(key)} />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: t.chip }} />
              <Txt size={11.5} color={t.mut2}>
                {tr('no e-mail?')}
              </Txt>
              <View style={{ flex: 1, height: 1, backgroundColor: t.chip }} />
            </View>
            <AuthField value={email} onChangeText={setEmail} placeholder={tr('email')} onSubmitEditing={resend} />
            {notice ? (
              <Txt size={12} weight="600" color={t.green} lh={1.5} accessibilityLiveRegion="polite">
                {notice}
              </Txt>
            ) : null}
            <AuthCta label={resendBusy ? tr('sending…') : tr('resend the e-mail')} enabled={email.indexOf('@') > 0} busy={resendBusy} onPress={resend} />
          </>
        )}
      </View>

      <TextLink label={tr('← back to sign in')} onPress={() => router.replace('/sign-in' as never)} />
    </AuthCanvas>
  );
}
