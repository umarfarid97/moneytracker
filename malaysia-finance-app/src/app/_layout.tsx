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
import { getThemeName } from '@/ui/appearance';
import { loadThemeFonts } from '@/ui/themeFonts';
import { useTheme } from '@/ui/useTheme';

const FONT_WAIT_MS = 700;

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // Outfit (Classic) is the fallback for every theme; the saved theme's own fonts load alongside it.
  const [fontsLoaded, setFontsLoaded] = useState(false);
  useEffect(() => {
    Promise.all([loadThemeFonts('classic'), loadThemeFonts(getThemeName())]).then(() => setFontsLoaded(true));
  }, []);
  // Safari can take a long time (or fail) to report the fonts as loaded, so the app shows after a short wait in the
  // system font and switches to the theme's font once the fonts arrive. The loading screen covers the gap.
  const [fontWaitOver, setFontWaitOver] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFontWaitOver(true), FONT_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);
  const ready = fontsLoaded || fontWaitOver;
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
