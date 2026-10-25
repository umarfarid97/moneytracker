import {
  Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, useFonts,
} from '@expo-google-fonts/outfit';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BillsSync } from '@/features/commitments/BillsSync';
import { RemindersSync } from '@/features/commitments/RemindersSync';
import { DataProvider } from '@/hooks/DataProvider';
import { SyncProvider } from '@/sync/SyncProvider';
import { useTheme } from '@/ui/useTheme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold });
  const { scheme, c } = useTheme();

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.ground }}>
      <SafeAreaProvider>
        <DataProvider>
          <BillsSync />
          <RemindersSync />
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <SyncProvider>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.ground } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="add-expense" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            </Stack>
          </SyncProvider>
        </DataProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
