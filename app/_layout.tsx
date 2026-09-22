import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  useFonts,
} from '@expo-google-fonts/space-grotesk';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '@/entities/user';
import { isApiConfigured } from '@/shared/api';
import { useTheme } from '@/shared/theme';
import { AppConfigErrorScreen, AppConnectionErrorScreen, AppLoadingScreen } from '@/widgets/app-status';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });
  const t = useTheme();
  const status = useAuth((s) => s.status);
  const initError = useAuth((s) => s.initError);
  const init = useAuth((s) => s.init);
  const retryInit = useAuth((s) => s.retryInit);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => init(), [init]);

  const onRetry = useCallback(() => {
    setRetrying(true);
    void retryInit().finally(() => setRetrying(false));
  }, [retryInit]);

  // No API address: never fall back to placeholder data.
  if (!isApiConfigured) return <AppConfigErrorScreen />;
  if (!fontsLoaded || status === 'initializing') return <AppLoadingScreen />;
  if (status === 'error') return <AppConnectionErrorScreen message={initError} onRetry={onRetry} retrying={retrying} />;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }} />
    </View>
  );
}
