import { Redirect } from 'expo-router';
import { useAuth } from '@/entities/user';
import { useOnboardingFlags } from '@/features/onboarding';

export default function Index() {
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  const onboarded = useOnboardingFlags((s) => s.onboarded);
  if (status !== 'signedIn') return <Redirect href={'/jobs' as never} />;
  if (user?.user_type === 'b2b') return <Redirect href={'/recruiter' as never} />;
  if (!onboarded) return <Redirect href={'/onboarding' as never} />;
  return <Redirect href={'/jobs' as never} />;
}
