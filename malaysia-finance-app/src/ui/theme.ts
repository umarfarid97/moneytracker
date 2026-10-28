/**
 * Design direction (since 2026-10-25): modelled on the KWSP i-Akaun app.
 * - Light grey ground, plain white rounded cards with a soft neutral shadow. No gradients.
 * - One strong royal blue for actions, links, chevrons, the active tab and headline balances.
 * - Plain black line icons, iOS-style list rows with thin dividers and blue chevrons.
 * - Green for money in, red-orange for money out.
 * - A large round blue + in the middle of the tab bar adds spending.
 * Dark mode keeps the same structure on iOS greys with a lighter blue.
 *
 * That is the Classic theme. Dark green (themeDefs.ts) swaps only fonts, colours, wallpaper and
 * card outlines; layout, sizes and components are shared.
 */
import type { Ionicons } from '@expo/vector-icons';
import { Platform, type ViewStyle } from 'react-native';
import type { Status } from '@/domain/budget';
import { THEMES, type Fonts, type Palette, type Scheme, type ThemeName } from './themeDefs';

export type { Palette, Scheme, ThemeName } from './themeDefs';

/** The Classic palettes: what the app has always looked like. Other themes live in THEMES. */
export const palette = THEMES.classic.palette;

let activeName: ThemeName = 'classic';

/** The theme currently applied (see applyTheme). */
export function activeTheme(): ThemeName {
  return activeName;
}

export const radius = { card: 22, control: 14, sm: 10, xs: 6, pill: 999 } as const;
/** Corner radius of cards, tiles and summary cards in the active theme. */
export function cardRadius(): number {
  return THEMES[activeName].cardRadius;
}

export const space = { xs: 4, s: 8, m: 12, gap: 16, pad: 20, xl: 24, xxl: 32 } as const;
export const controlHeight = 50;

/**
 * The active theme's font families (Classic uses Outfit). Each weight is its own loaded family
 * (see themeFonts.ts), so text sets the family for its weight instead of fontWeight.
 * applyTheme() rewrites these in place before screens re-render, so `fontFamily.medium` is always current.
 */
export const fontFamily: Fonts = { ...THEMES.classic.fonts };

/** Switches the module-level theme state (fonts, card outlines, status colours). The app calls it via setThemeName. */
export function applyTheme(name: ThemeName): void {
  activeName = name;
  Object.assign(fontFamily, THEMES[name].fonts);
}

export const fontSize = { title: 32, section: 20, kpi: 36, body: 16, small: 14 } as const;

/**
 * Soft neutral elevation for cards; dark mode relies on the lighter surface instead.
 * Android draws every elevation as a real shadow layer, so it gets a light one to keep scrolling smooth.
 */
export function elevation(scheme: Scheme): ViewStyle {
  if (scheme === 'dark') return {};
  if (Platform.OS === 'android') return { elevation: 2 };
  return {
    shadowColor: '#0b1530',
    shadowOpacity: 0.07,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  };
}

/** Outline and/or shadow that lifts a card off the ground, as the active theme prescribes. */
export function cardChrome(c: Palette, scheme: Scheme): ViewStyle {
  const kind = THEMES[activeName].card[scheme];
  const border: ViewStyle = { borderWidth: 1, borderColor: c.border };
  if (kind === 'none') return {};
  if (kind === 'border') return border;
  if (kind === 'both') return { ...border, ...(Platform.OS === 'android' ? { elevation: 1 } : lightShadow()) };
  return elevation(scheme);
}

function lightShadow(): ViewStyle {
  return { shadowColor: '#0b1530', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };
}

/** Lift under a prominent surface such as the tab bar's + button. `color` tints the shadow slightly. */
export function glow(color: string, scheme: Scheme): ViewStyle {
  if (THEMES[activeName].tabIndicator === 'drop') return {};
  if (activeName !== 'classic') {
    if (Platform.OS === 'android') return { elevation: 6, shadowColor: color };
    return { shadowColor: color, shadowOpacity: 0.55, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 6 };
  }
  if (scheme === 'dark') return {};
  if (Platform.OS === 'android') return { elevation: 4 };
  return { shadowColor: color, shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 };
}

export type Hero = 'brand' | 'ocean' | 'mint' | 'sunset';

/** Gradients behind each tab's summary card. White text stays readable (4.5:1) on every stop. */
const HEROES: Record<Scheme, Record<Hero, readonly [string, string, string]>> = {
  light: {
    brand: ['#4f46e5', '#7c3aed', '#c026d3'],
    ocean: ['#1d4ed8', '#4f46e5', '#7c3aed'],
    mint: ['#0f766e', '#0e7490', '#1d4ed8'],
    sunset: ['#c2410c', '#be123c', '#a21caf'],
  },
  dark: {
    brand: ['#3730a3', '#5b21b6', '#86198f'],
    ocean: ['#1e3a8a', '#3730a3', '#5b21b6'],
    mint: ['#115e59', '#155e75', '#1e3a8a'],
    sunset: ['#9a3412', '#9f1239', '#86198f'],
  },
};

export function heroGradient(hero: Hero, scheme: Scheme): readonly [string, string, string] {
  return HEROES[scheme][hero];
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
const CATEGORY_COLOR = palette.light.accent;

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
  return { icon: picked ?? CATEGORY_ICON[name] ?? 'pricetag-outline', color: activeName === 'classic' ? CATEGORY_COLOR : THEMES[activeName].palette.dark.accent };
}

/** Tint for a category tag. The design keeps tags neutral, so every category shares the same tag colours. */
export function categoryTint(_name: string, scheme: Scheme, theme: ThemeName = activeName): { bg: string; ink: string } {
  const p = THEMES[theme].palette[scheme];
  return { bg: p.tagBg, ink: p.tagInk };
}

export function statusStyle(status: Status, scheme: Scheme, theme: ThemeName = activeName): { bg: string; ink: string } {
  return THEMES[theme].status[scheme][status];
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
