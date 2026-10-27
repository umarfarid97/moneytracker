import {
  Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, useFonts,
} from '@expo-google-fonts/outfit';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BillsSync } from '@/features/commitments/BillsSync';
import { IncomeSync } from '@/features/income/IncomeSync';
import { RemindersSync } from '@/features/commitments/RemindersSync';
import { useLanguage } from '@/i18n/language';
import { AppLockGate } from '@/features/security/AppLockGate';
import { DataProvider } from '@/hooks/DataProvider';
import { QuickAddSync } from '@/quickAdd/QuickAddSync';
import { SyncProvider } from '@/sync/SyncProvider';
import { useTheme } from '@/ui/useTheme';

const FONT_WAIT_MS = 700;

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold });
  // Safari can take a long time (or fail) to report the fonts as loaded, so the app shows after a short wait in the
  // system font and switches to Outfit once the fonts arrive. The loading screen covers the gap.
  const [fontWaitOver, setFontWaitOver] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFontWaitOver(true), FONT_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);
  const ready = fontsLoaded || fontError != null || fontWaitOver;
  const { scheme, c } = useTheme();
  const language = useLanguage();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.ground }}>
      <SafeAreaProvider>
        <DataProvider>
          <BillsSync />
          <IncomeSync />
          <RemindersSync />
          <QuickAddSync />
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <SyncProvider>
            <AppLockGate>
              {/* Screens read strings through t(), so a new language needs a fresh render of the navigator. */}
              <Stack key={language} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.ground } }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="add-expense" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              </Stack>
            </AppLockGate>
          </SyncProvider>
        </DataProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
