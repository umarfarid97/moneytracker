/** Manrope, the app's only typeface. Loaded once at start-up; text uses the system font until it arrives. */
import * as Font from 'expo-font';
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';

let loading: Promise<void> | undefined;

/** Resolves once the fonts are ready. Never rejects: on a failed download text uses the system font. */
export function loadFonts(): Promise<void> {
  loading ??= Font.loadAsync({ Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold }).catch(() => {
    loading = undefined;
  });
  return loading;
}
