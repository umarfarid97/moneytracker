/**
 * Design direction: one dark green look modelled on the Aether mockup.
 * - Near-black ground with soft green light streaks (Wallpaper), charcoal rounded cards, no shadows.
 * - A pale lime-mint accent for buttons, highlights and the active tab; mint for gains, lilac for losses.
 * - A sage-green gradient summary card at the top of each tab.
 * - Manrope, spaced uppercase eyebrow labels, a floating pill behind the active tab.
 * All tokens live in themeDefs.ts; screens read them through useTheme() and never hard-code colours.
 */
import type { Ionicons } from '@expo/vector-icons';
import { Platform, type ViewStyle } from 'react-native';
import type { Status } from '@/domain/budget';
import { FONTS, PALETTE, STATUS, type Fonts, type Palette, type Scheme } from './themeDefs';

export type { Palette, Scheme } from './themeDefs';

export const palette = PALETTE;

export const radius = { card: 22, control: 14, sm: 10, xs: 6, pill: 999 } as const;
export const space = { xs: 4, s: 8, m: 12, gap: 16, pad: 20, xl: 24, xxl: 32 } as const;
export const controlHeight = 50;

/** Manrope. Each weight is its own loaded family (see themeFonts.ts), so text sets the family instead of fontWeight. */
export const fontFamily: Fonts = FONTS;

export const fontSize = { title: 32, section: 20, kpi: 36, body: 16, small: 14 } as const;

/** Cards are flat charcoal with a hairline edge; the dark ground does the separating, so no shadow. */
export function elevation(_scheme: Scheme): ViewStyle {
  return {};
}

/** Outline that lifts a card off the ground. */
export function cardChrome(c: Palette, _scheme: Scheme): ViewStyle {
  return { borderWidth: 1, borderColor: c.border };
}

/** Soft green glow under a prominent surface such as the active tab pill and the + button. */
export function glow(color: string, _scheme: Scheme): ViewStyle {
  if (Platform.OS === 'android') return { elevation: 6, shadowColor: color };
  return { shadowColor: color, shadowOpacity: 0.55, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 6 };
}

export type IconName = keyof typeof Ionicons.glyphMap;

/** Each built-in category's line icon. Icons are drawn in plain ink (see IconBadge); the colour is the accent. */
const CATEGORY_ICON: Record<string, IconName> = {
  Makan: 'fast-food-outline',
  Transport: 'car-outline',
  Bil: 'receipt-outline',
  Rumah: 'home-outline',
  Hiburan: 'film-outline',
  Kesihatan: 'heart-outline',
  Pendidikan: 'school-outline',
  'Lain-lain': 'apps-outline',
};
const CATEGORY_COLOR = palette.accent;

/** Line icons a user can pick for a category, grouped loosely by theme (food, travel, home, health, ...). */
export const CATEGORY_ICONS: readonly IconName[] = [
  'fast-food-outline', 'restaurant-outline', 'cafe-outline', 'pizza-outline', 'beer-outline', 'wine-outline',
  'ice-cream-outline', 'nutrition-outline', 'fish-outline', 'cart-outline', 'basket-outline', 'bag-handle-outline',
  'storefront-outline', 'car-outline', 'car-sport-outline', 'bus-outline', 'train-outline', 'subway-outline',
  'bicycle-outline', 'airplane-outline', 'boat-outline', 'speedometer-outline', 'navigate-outline', 'home-outline',
  'bed-outline', 'receipt-outline', 'flash-outline', 'water-outline', 'wifi-outline', 'phone-portrait-outline',
  'tv-outline', 'construct-outline', 'hammer-outline', 'key-outline', 'bulb-outline', 'flame-outline',
  'heart-outline', 'medkit-outline', 'fitness-outline', 'barbell-outline', 'bandage-outline', 'pulse-outline',
  'people-outline', 'person-outline', 'happy-outline', 'paw-outline', 'flower-outline', 'leaf-outline',
  'rose-outline', 'school-outline', 'book-outline', 'library-outline', 'briefcase-outline', 'business-outline',
  'laptop-outline', 'desktop-outline', 'calculator-outline', 'pencil-outline', 'film-outline', 'musical-notes-outline',
  'game-controller-outline', 'headset-outline', 'camera-outline', 'ticket-outline', 'football-outline',
  'basketball-outline', 'golf-outline', 'tennisball-outline', 'wallet-outline', 'card-outline', 'cash-outline',
  'pricetag-outline', 'pricetags-outline', 'gift-outline', 'diamond-outline', 'trending-up-outline',
  'stats-chart-outline', 'pie-chart-outline', 'shield-checkmark-outline', 'umbrella-outline', 'shirt-outline',
  'cut-outline', 'glasses-outline', 'sparkles-outline', 'globe-outline', 'planet-outline', 'star-outline',
  'moon-outline', 'sunny-outline', 'apps-outline',
];
const PICKABLE = new Set<string>(CATEGORY_ICONS);

/**
 * Icon and colour for a category. An icon the user picked wins; otherwise built-in categories have their own
 * and the ones the user adds get a tag. (Older rows store names like "utensils", which aren't pickable icons.)
 */
export function categoryLook(name: string, icon?: string): { icon: IconName; color: string } {
  const picked = icon !== undefined && PICKABLE.has(icon) ? (icon as IconName) : undefined;
  return { icon: picked ?? CATEGORY_ICON[name] ?? 'pricetag-outline', color: CATEGORY_COLOR };
}

/** Tint for a category tag. The design keeps tags neutral, so every category shares the same tag colours. */
export function categoryTint(_name: string, _scheme: Scheme = 'dark'): { bg: string; ink: string } {
  return { bg: palette.tagBg, ink: palette.tagInk };
}

export function statusStyle(status: Status, _scheme: Scheme = 'dark'): { bg: string; ink: string } {
  return STATUS[status];
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG contrast ratio between two #rrggbb colours. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
