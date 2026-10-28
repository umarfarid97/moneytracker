/**
 * Fonts per theme, loaded on demand so a phone only downloads the family of the theme in use.
 * Classic's Outfit is always loaded because the app opens in it and falls back to it.
 */
import * as Font from 'expo-font';
import { Outfit_400Regular } from '@expo-google-fonts/outfit/400Regular';
import { Outfit_500Medium } from '@expo-google-fonts/outfit/500Medium';
import { Outfit_600SemiBold } from '@expo-google-fonts/outfit/600SemiBold';
import { Outfit_700Bold } from '@expo-google-fonts/outfit/700Bold';
import type { ThemeName } from './themeDefs';

type FontMap = Record<string, number | string>;

const LOADERS: Record<ThemeName, () => Promise<FontMap>> = {
  // Classic is imported statically: the app opens in it, so it ships with the main bundle.
  classic: async () => ({ Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold }),
  saas: async () => {
    const [a, b, c, d] = await Promise.all([
      import('@expo-google-fonts/inter/400Regular'),
      import('@expo-google-fonts/inter/500Medium'),
      import('@expo-google-fonts/inter/600SemiBold'),
      import('@expo-google-fonts/inter/700Bold'),
    ]);
    return { Inter_400Regular: a.Inter_400Regular, Inter_500Medium: b.Inter_500Medium, Inter_600SemiBold: c.Inter_600SemiBold, Inter_700Bold: d.Inter_700Bold };
  },
  terminal: async () => {
    const [a, b, c, d] = await Promise.all([
      import('@expo-google-fonts/jetbrains-mono/400Regular'),
      import('@expo-google-fonts/jetbrains-mono/500Medium'),
      import('@expo-google-fonts/jetbrains-mono/600SemiBold'),
      import('@expo-google-fonts/jetbrains-mono/700Bold'),
    ]);
    return {
      JetBrainsMono_400Regular: a.JetBrainsMono_400Regular, JetBrainsMono_500Medium: b.JetBrainsMono_500Medium,
      JetBrainsMono_600SemiBold: c.JetBrainsMono_600SemiBold, JetBrainsMono_700Bold: d.JetBrainsMono_700Bold,
    };
  },
  notepad: async () => {
    const [a, b] = await Promise.all([
      import('@expo-google-fonts/patrick-hand/400Regular'),
      import('@expo-google-fonts/caveat/700Bold'),
    ]);
    return { PatrickHand_400Regular: a.PatrickHand_400Regular, Caveat_700Bold: b.Caveat_700Bold };
  },
};

const loaded = new Map<ThemeName, Promise<void>>();

/** Resolves once the theme's fonts are ready. Never rejects: on a failed download text uses the system font. */
export function loadThemeFonts(name: ThemeName): Promise<void> {
  let p = loaded.get(name);
  if (!p) {
    p = LOADERS[name]()
      .then((map) => Font.loadAsync(map))
      .catch(() => {
        loaded.delete(name);
      });
    loaded.set(name, p);
  }
  return p;
}
