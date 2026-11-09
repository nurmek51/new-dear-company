import { Redirect, Slot, usePathname } from 'expo-router';
import { View } from 'react-native';
import { isRecruiter, useAuth } from '@/entities/user';
import { useTheme } from '@/shared/theme';
import { RecruiterTopBar } from '@/widgets/recruiter-topbar';

/** Recruiter shell: requires a recruiter profile, except onboarding. */
export default function RecruiterLayout() {
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  const t = useTheme();
  const pathname = usePathname();
  const isOnboarding = pathname.startsWith('/recruiter/onboarding');
  if (isOnboarding) return <Slot />;
  if (status !== 'signedIn') return <Redirect href={'/sign-in?mode=recruiter' as never} />;
  if (!isRecruiter(user)) return <Redirect href={'/recruiter/onboarding' as never} />;
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <RecruiterTopBar />
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
    </View>
  );
}
