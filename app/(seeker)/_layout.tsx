import { Redirect, Slot, usePathname } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from '@/entities/user';
import { useTheme } from '@/shared/theme';
import { NavBar } from '@/widgets/nav-bar';
import { TipCoach } from '@/widgets/tip-coach';

/** Seeker shell. Jobs list/detail are public (spec §2.2/2.3); the rest needs a session. */
export default function SeekerLayout() {
  const status = useAuth((s) => s.status);
  const t = useTheme();
  const pathname = usePathname();
  const screen = pathname.replace(/^\//, '').split('/')[0] || 'jobs';
  const publicScreens = ['jobs', 'job', 'plus'];
  if (status !== 'signedIn' && !publicScreens.includes(screen)) {
    return <Redirect href={'/sign-in' as never} />;
  }
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <NavBar />
        <View style={{ flex: 1 }}>
          <Slot />
        </View>
        <TipCoach screen={screen} />
      </View>
    </SafeAreaProvider>
  );
}
