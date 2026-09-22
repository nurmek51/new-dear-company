import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, View, type ViewStyle } from 'react-native';
import { authApi, useAuth } from '@/entities/user';
import { useTipsStore } from '@/features/tips';
import { ApiError } from '@/shared/api';
import { useBreakpoint } from '@/shared/lib/responsive';
import { useT } from '@/shared/lib/useT';
import { accent, accentInk, useTheme } from '@/shared/theme';
import { Card, Field, Txt } from '@/shared/ui';

/** The backend serializer rejects anything over 5MB (the upload view says 10MB). */
const MAX_PICTURE_BYTES = 5 * 1024 * 1024;
const PICTURE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

function msgOf(e: unknown, fallback: string, offline: string): string {
  if (e instanceof ApiError) return e.isNetworkError ? offline : e.message;
  return fallback;
}

/** Profile input: bg token, transparent 1.5 border, radius 11, 12 15, 13.5. */
function ProfileField(props: { value: string; onChangeText: (v: string) => void; placeholder: string; secure?: boolean; invalid?: boolean }) {
  const t = useTheme();
  return (
    <Field
      value={props.value}
      onChangeText={props.onChangeText}
      placeholder={props.placeholder}
      secure={props.secure}
      bg={t.bg}
      size={13.5}
      radius={11}
      borderColor={props.invalid ? '#b91c1c' : 'transparent'}
      style={{ paddingHorizontal: 15, paddingVertical: 12, borderWidth: 1.5 }}
    />
  );
}

/** Lime action button 13/700, 11 18, radius 11 (design "hide" button shape). */
function AccentBtn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const t = useTheme();
  const on = !disabled;
  return (
    <Pressable
      onPress={on ? onPress : undefined}
      accessibilityRole="button"
      accessibilityState={{ disabled: !on }}
      style={(s) => ({
        paddingVertical: 11,
        paddingHorizontal: 18,
        borderRadius: 11,
        backgroundColor: on ? accent : t.chip,
        alignSelf: 'flex-start',
        opacity: (s as { hovered?: boolean }).hovered && on ? 0.9 : 1,
        ...(on ? null : { cursor: 'default' }),
      }) as ViewStyle}
    >
      <Txt size={13} weight="700" color={on ? accentInk : t.mut2}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** Translucent button on the dark card: 12.5/700, 9 16, radius 10. */
function DarkBtn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={(s) => ({
        paddingVertical: 9,
        paddingHorizontal: 16,
        borderRadius: 10,
        backgroundColor: 'rgba(246,244,238,.14)',
        opacity: disabled ? 0.6 : (s as { hovered?: boolean }).hovered ? 0.85 : 1,
      })}
    >
      <Txt size={12.5} weight="700" color="#F6F4EE">
        {label}
      </Txt>
    </Pressable>
  );
}

function ReadOnlyChip({ label, tone }: { label: string; tone?: 'green' | 'muted' }) {
  const t = useTheme();
  const bg = tone === 'green' ? t.greenbg : t.chip;
  const color = tone === 'green' ? t.green : t.ink2;
  return (
    <View style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: bg }}>
      <Txt size={13} weight="600" color={color}>
        {label}
      </Txt>
    </View>
  );
}

function Note({ text, tone }: { text: string | null; tone: 'error' | 'ok' }) {
  const t = useTheme();
  if (!text) return null;
  return (
    <Txt size={12} weight="600" color={tone === 'error' ? '#b91c1c' : t.green} lh={1.5} accessibilityLiveRegion="polite">
      {text}
    </Txt>
  );
}

export function ProfilePage() {
  const t = useTheme();
  const tr = useT();
  const router = useRouter();
  const { isMobile, gutter } = useBreakpoint();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const reloadUser = useAuth((s) => s.reloadUser);
  const signOut = useAuth((s) => s.signOut);
  const submitting = useAuth((s) => s.submitting);
  const restartTips = useTipsStore((s) => s.restartTips);
  const offline = tr('could not reach the server. check your connection and try again.');

  // --- name (PATCH /api/v1/auth/user/, spec §1.5)
  const [name, setName] = useState(user?.name ?? '');
  const [nameBusy, setNameBusy] = useState(false);
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [nameOk, setNameOk] = useState<string | null>(null);
  useEffect(() => setName(user?.name ?? ''), [user?.name]);
  const nameDirty = name.trim() !== (user?.name ?? '').trim() && name.trim().length > 0;

  const saveName = useCallback(async () => {
    if (!user || !nameDirty || nameBusy) return;
    setNameBusy(true);
    setNameErr(null);
    setNameOk(null);
    try {
      const updated = await authApi.updateMe({ name: name.trim() });
      setUser(updated);
      setNameOk(tr('saved.'));
    } catch (e) {
      setNameErr(msgOf(e, tr('could not save your name. please try again.'), offline));
    } finally {
      setNameBusy(false);
    }
  }, [name, nameBusy, nameDirty, offline, setUser, tr, user]);

  // --- avatar (POST /api/v1/accounts/profile-picture/upload/, spec §1.13)
  const [picBusy, setPicBusy] = useState(false);
  const [picErr, setPicErr] = useState<string | null>(null);
  const [picOk, setPicOk] = useState<string | null>(null);

  const pickPicture = useCallback(async () => {
    if (picBusy) return;
    setPicErr(null);
    setPicOk(null);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    const mime = asset.mimeType ?? asset.file?.type ?? 'image/jpeg';
    if (!PICTURE_TYPES.includes(mime)) {
      setPicErr(tr('use a jpeg, png or webp image.'));
      return;
    }
    const size = asset.fileSize ?? asset.file?.size ?? 0;
    if (size > MAX_PICTURE_BYTES) {
      setPicErr(tr('that image is over 5 mb.'));
      return;
    }
    setPicBusy(true);
    try {
      const form = new FormData();
      const fileName = asset.fileName ?? asset.file?.name ?? `avatar.${mime.split('/')[1] ?? 'jpg'}`;
      if (Platform.OS === 'web') {
        const blob = asset.file ?? (await (await fetch(asset.uri)).blob());
        form.append('profile_picture', blob, fileName);
      } else {
        form.append('profile_picture', { uri: asset.uri, name: fileName, type: mime } as unknown as Blob);
      }
      await authApi.uploadProfilePicture(form);
      await reloadUser();
      setPicOk(tr('photo updated.'));
    } catch (e) {
      setPicErr(msgOf(e, tr('upload failed. please try again.'), offline));
    } finally {
      setPicBusy(false);
    }
  }, [offline, picBusy, reloadUser, tr]);

  // --- password (POST /api/v1/auth/password/change/, spec §1.10)
  const [oldPw, setOldPw] = useState('');
  const [newPw1, setNewPw1] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState<string | null>(null);
  const pwMismatch = newPw2.length > 0 && newPw1 !== newPw2;
  const pwReady = oldPw.length > 0 && newPw1.length >= 8 && newPw2.length > 0 && !pwMismatch;

  const changePw = useCallback(async () => {
    if (!pwReady || pwBusy) return;
    setPwBusy(true);
    setPwErr(null);
    setPwOk(null);
    try {
      await authApi.changePassword(oldPw, newPw1, newPw2);
      setOldPw('');
      setNewPw1('');
      setNewPw2('');
      setPwOk(tr('password changed.'));
    } catch (e) {
      setPwErr(msgOf(e, tr('could not change the password. check the current one and try again.'), offline));
    } finally {
      setPwBusy(false);
    }
  }, [newPw1, newPw2, offline, oldPw, pwBusy, pwReady, tr]);

  // --- tips + sign out
  const [tipsNote, setTipsNote] = useState<string | null>(null);
  const [confirmOut, setConfirmOut] = useState(false);
  const doSignOut = useCallback(async () => {
    await signOut();
    router.replace('/sign-in' as never);
  }, [router, signOut]);

  if (!user) return null;

  const initial = (user.name || user.email || 'u').trim().charAt(0).toLowerCase() || 'u';
  const h1 = isMobile ? 29 : 46;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 44 }}>
      {/* header */}
      <View style={{ paddingTop: 38, paddingHorizontal: gutter, paddingBottom: 8, gap: 12 }}>
        <View>
          <Txt size={h1} weight="700" lh={1.05} ls={-0.04}>
            {tr('your space,')}
          </Txt>
          <View style={{ alignSelf: 'flex-start', backgroundColor: accent, borderRadius: 10, paddingHorizontal: 14, transform: [{ rotate: '-1.2deg' }] }}>
            <Txt size={h1} weight="700" lh={1.05} ls={-0.04} color={accentInk}>
              {tr('your rules')}
            </Txt>
          </View>
        </View>
        <Txt size={isMobile ? 14 : 15.5} color={t.mut}>
          {tr('everything here works for you, not on you. change anything.')}
        </Txt>
      </View>

      {/* two-column grid (1fr 1fr, gap 24, max 1100) */}
      <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 24, paddingTop: 24, paddingHorizontal: gutter, maxWidth: 1100 + gutter * 2, alignItems: 'flex-start' }}>
        {/* left */}
        <View style={{ flex: 1, width: '100%', gap: 14 }}>
          <Card radius={20} padding={24} gap={16}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Pressable onPress={pickPicture} accessibilityRole="button" accessibilityLabel={tr('change photo')} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#141519', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {user.profile_picture_display ? (
                  <Image source={{ uri: user.profile_picture_display }} style={{ width: 52, height: 52 }} accessibilityLabel={tr('your photo')} />
                ) : (
                  <Txt size={20} weight="700" color={accent}>
                    {initial}
                  </Txt>
                )}
              </Pressable>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt size={17} weight="700" ls={-0.01}>
                  {tr('who you are')}
                </Txt>
                <Txt size={12.5} color={t.mut}>
                  {tr('only shown to companies you apply to')}
                </Txt>
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <ProfileField value={name} onChangeText={setName} placeholder={tr('your name')} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                {user.email ? <ReadOnlyChip label={user.email} /> : null}
                {user.phone_number ? <ReadOnlyChip label={user.phone_number} /> : null}
                <ReadOnlyChip label={user.email_verified ? tr('✓ email verified') : tr('email not verified')} tone={user.email_verified ? 'green' : 'muted'} />
                {user.phone_number ? <ReadOnlyChip label={user.phone_verified ? tr('✓ phone verified') : tr('phone not verified')} tone={user.phone_verified ? 'green' : 'muted'} /> : null}
              </View>
              <Note text={nameErr} tone="error" />
              <Note text={nameOk} tone="ok" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <AccentBtn label={nameBusy ? tr('saving…') : tr('save name')} onPress={saveName} disabled={!nameDirty || nameBusy} />
                <Pressable onPress={pickPicture} accessibilityRole="button" style={(s) => ({ paddingVertical: 11, paddingHorizontal: 14, opacity: (s as { hovered?: boolean }).hovered ? 0.75 : 1 })}>
                  <Txt size={13} weight="600" color={t.mut}>
                    {picBusy ? tr('uploading…') : tr('change photo')}
                  </Txt>
                </Pressable>
              </View>
              <Note text={picErr} tone="error" />
              <Note text={picOk} tone="ok" />
            </View>
          </Card>

          <View style={{ backgroundColor: '#141519', borderRadius: 20, paddingVertical: 20, paddingHorizontal: 24, gap: 6 }}>
            <Txt size={13.5} weight="700" color="#F6F4EE">
              {tr('your data, your call')}
            </Txt>
            <Txt size={12.5} color="#a1a1aa" lh={1.55}>
              {tr('replay the coach tips on every screen, or sign out of this device. data export and account deletion are coming soon.')}
            </Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6, alignItems: 'center' }}>
              <DarkBtn
                label={tr('show tips again')}
                onPress={() => {
                  restartTips();
                  setTipsNote(tr('tips will show again on each screen.'));
                }}
              />
              {confirmOut ? (
                <>
                  <DarkBtn label={submitting ? tr('signing out…') : tr('yes, sign out')} onPress={doSignOut} disabled={submitting} />
                  <DarkBtn label={tr('cancel')} onPress={() => setConfirmOut(false)} disabled={submitting} />
                </>
              ) : (
                <DarkBtn label={tr('sign out')} onPress={() => setConfirmOut(true)} />
              )}
            </View>
            {tipsNote ? (
              <Txt size={11.5} color="#a1a1aa" accessibilityLiveRegion="polite">
                {tipsNote}
              </Txt>
            ) : null}
          </View>
        </View>

        {/* right */}
        <View style={{ flex: 1, width: '100%', gap: 14 }}>
          <Card radius={20} padding={24} gap={14}>
            <View style={{ gap: 3 }}>
              <Txt size={17} weight="700" ls={-0.01}>
                {tr('🔐 password')}
              </Txt>
              <Txt size={12.5} color={t.mut} lh={1.55}>
                {tr('8 characters minimum. you stay signed in on this device after changing it.')}
              </Txt>
            </View>
            <View style={{ gap: 8 }}>
              <ProfileField value={oldPw} onChangeText={setOldPw} placeholder={tr('current password')} secure />
              <ProfileField value={newPw1} onChangeText={setNewPw1} placeholder={tr('new password')} secure invalid={newPw1.length > 0 && newPw1.length < 8} />
              <ProfileField value={newPw2} onChangeText={setNewPw2} placeholder={tr('repeat new password')} secure invalid={pwMismatch} />
            </View>
            {pwMismatch ? <Note text={tr('the two passwords do not match.')} tone="error" /> : null}
            <Note text={pwErr} tone="error" />
            <Note text={pwOk} tone="ok" />
            <AccentBtn label={pwBusy ? tr('changing…') : tr('change password')} onPress={changePw} disabled={!pwReady || pwBusy} />
          </Card>
        </View>
      </View>
    </ScrollView>
  );
}
