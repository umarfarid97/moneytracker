/**
 * Design direction (since 2026-10-25): modelled on the KWSP i-Akaun app.
 * - Light grey ground, plain white rounded cards with a soft neutral shadow. No gradients.
 * - One strong royal blue for actions, links, chevrons, the active tab and headline balances.
 * - Plain black line icons, iOS-style list rows with thin dividers and blue chevrons.
 * - Green for money in, red-orange for money out.
 * - A large round blue + in the middle of the tab bar adds spending.
 * Dark mode keeps the same structure on iOS greys with a lighter blue.
 */
import type { Ionicons } from '@expo/vector-icons';
import { Platform, type ViewStyle } from 'react-native';
import type { Status } from '@/domain/budget';

export type Scheme = 'light' | 'dark';

export const palette = {
  light: {
    ground: '#f4f5f7',
    surface: '#ffffff',
    raised: '#f6f7f9',
    border: '#e6e8ec',
    control: '#d8dce3',
    track: '#e9ecf1',
    text: '#111318',
    muted: '#62677a',
    accent: '#0d5bd3',
    onAccent: '#ffffff',
    accentSoft: '#e8f0fc',
    accentInk: '#0a47a6',
    positive: '#13a150',
    negative: '#d9430c',
    warning: '#a14a05',
    /** Solid: primary buttons and the + use the plain accent. */
    brand: ['#0d5bd3', '#0d5bd3'],
    /** No wash: screens sit on the plain ground. */
    wash: ['#f4f5f7', '#f4f5f7'],
  },
  dark: {
    ground: '#000000',
    surface: '#1c1c1e',
    raised: '#2c2c2e',
    border: '#38383a',
    control: '#48484a',
    track: '#2c2c2e',
    text: '#f5f5f7',
    muted: '#9a9aa1',
    accent: '#5b9bff',
    onAccent: '#04122b',
    accentSoft: '#13274a',
    accentInk: '#a9c8ff',
    positive: '#4fd27f',
    negative: '#ff8a5c',
    warning: '#f5b565',
    brand: ['#5b9bff', '#5b9bff'],
    wash: ['#000000', '#000000'],
  },
} as const;

export type Palette = (typeof palette)[Scheme];

export const radius = { card: 22, control: 14, sm: 10, xs: 6, pill: 999 } as const;
export const space = { xs: 4, s: 8, m: 12, gap: 16, pad: 20, xl: 24, xxl: 32 } as const;
export const controlHeight = 50;

/**
 * Outfit, a rounded geometric sans close to the KWSP app's font. Each weight is its own loaded family
 * (see the root layout), so text sets the family for its weight instead of fontWeight.
 */
export const fontFamily = {
  regular: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semibold: 'Outfit_600SemiBold',
  bold: 'Outfit_700Bold',
} as const;

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

/** Lift under a prominent surface such as the tab bar's + button. `color` tints the shadow slightly. */
export function glow(color: string, scheme: Scheme): ViewStyle {
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

type IconName = keyof typeof Ionicons.glyphMap;

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

/** Icon and colour for a category; categories the user adds get a tag. */
export function categoryLook(name: string): { icon: IconName; color: string } {
  return { icon: CATEGORY_ICON[name] ?? 'pricetag-outline', color: CATEGORY_COLOR };
}

/** Tint for a category tag. The design keeps tags neutral, so every category shares the same grey. */
export function categoryTint(_name: string, scheme: Scheme): { bg: string; ink: string } {
  return scheme === 'dark' ? { bg: '#2a2f34', ink: '#d3d7db' } : { bg: '#eef0f3', ink: '#3a3f4b' };
}

const STATUS: Record<Scheme, Record<Status, { bg: string; ink: string }>> = {
  light: {
    'on-track': { bg: '#dcfae5', ink: '#04250e' },
    tight: { bg: '#ffefc2', ink: '#7a3410' },
    over: { bg: '#ffedea', ink: '#831c1e' },
  },
  dark: {
    'on-track': { bg: '#123b22', ink: '#a8efc0' },
    tight: { bg: '#43310a', ink: '#ffd98a' },
    over: { bg: '#4a1a1c', ink: '#ffbcbd' },
  },
};

export function statusStyle(status: Status, scheme: Scheme): { bg: string; ink: string } {
  return STATUS[scheme][status];
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
