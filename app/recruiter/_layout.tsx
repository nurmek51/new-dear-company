import { Redirect, Slot, usePathname } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from '@/entities/user';
import { useTheme } from '@/shared/theme';
import { RecruiterTopBar } from '@/widgets/recruiter-topbar';

/** Recruiter shell: requires a b2b session (spec §0.1 IsB2BUser) except onboarding. */
export default function RecruiterLayout() {
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  const t = useTheme();
  const pathname = usePathname();
  const isOnboarding = pathname.startsWith('/recruiter/onboarding');
  if (isOnboarding) return <Slot />;
  if (status !== 'signedIn') return <Redirect href={'/sign-in?mode=recruiter' as never} />;
  if (user?.user_type !== 'b2b') return <Redirect href={'/recruiter/onboarding' as never} />;
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <RecruiterTopBar />
        <View style={{ flex: 1 }}>
          <Slot />
        </View>
      </View>
    </SafeAreaProvider>
  );
}
