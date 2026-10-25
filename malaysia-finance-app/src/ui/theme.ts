/**
 * Design direction: a vibrant, iOS-like look for a modern SaaS app.
 * - Cool lavender ground with a soft indigo wash at the top, white cards with tinted shadows.
 * - Indigo-to-violet brand gradient on primary buttons and the FAB; each tab's summary sits on a gradient hero card.
 * - Every category has its own colour and icon, used on chips, list rows and tiles.
 * - SF system font with real weights, bold large titles, tabular figures for money.
 * Dark mode follows iOS: near-black ground, #1c1c1e cards, deeper gradients.
 */
import type { Ionicons } from '@expo/vector-icons';
import { Platform, type ViewStyle } from 'react-native';
import type { Status } from '@/domain/budget';

export type Scheme = 'light' | 'dark';

export const palette = {
  light: {
    ground: '#f4f5fb',
    surface: '#ffffff',
    raised: '#f7f8fc',
    border: '#e7e8f1',
    control: '#dcdfea',
    track: '#eceef6',
    text: '#0f1222',
    muted: '#5d6277',
    accent: '#4f46e5',
    onAccent: '#ffffff',
    accentSoft: '#ecebfe',
    accentInk: '#3730a3',
    positive: '#15803d',
    negative: '#dc2626',
    warning: '#a14a05',
    /** Brand gradient for primary buttons and the FAB. */
    brand: ['#4f46e5', '#7c3aed'],
    /** Soft wash behind the top of every screen. */
    wash: ['#e6e4ff', '#f4f5fb'],
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
    accent: '#8b8cff',
    onAccent: '#0b0a2e',
    accentSoft: '#232150',
    accentInk: '#c4c5ff',
    positive: '#5fd283',
    negative: '#ff7b80',
    warning: '#f5b565',
    brand: ['#8b8cff', '#b794ff'],
    wash: ['#15133a', '#000000'],
  },
} as const;

export type Palette = (typeof palette)[Scheme];

export const radius = { card: 22, control: 14, sm: 10, xs: 6, pill: 999 } as const;
export const space = { xs: 4, s: 8, m: 12, gap: 16, pad: 20, xl: 24, xxl: 32 } as const;
export const controlHeight = 50;

const SYSTEM_FONT = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
}) as string;
/** All weights share the system font; weight comes from fontWeight (see AppText). */
export const fontFamily = { regular: SYSTEM_FONT, medium: SYSTEM_FONT, semibold: SYSTEM_FONT } as const;

export const fontSize = { title: 32, section: 20, kpi: 36, body: 16, small: 14 } as const;

/**
 * Soft, slightly indigo elevation for cards; dark mode relies on the lighter surface instead.
 * Android draws every elevation as a real shadow layer, so it gets a light one to keep scrolling smooth.
 */
export function elevation(scheme: Scheme): ViewStyle {
  if (scheme === 'dark') return {};
  if (Platform.OS === 'android') return { elevation: 2 };
  return {
    shadowColor: '#3b3a8f',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  };
}

/** Coloured glow under a gradient surface, e.g. a hero card or the FAB. */
export function glow(color: string, scheme: Scheme): ViewStyle {
  if (scheme === 'dark') return {};
  if (Platform.OS === 'android') return { elevation: 3 };
  return { shadowColor: color, shadowOpacity: 0.32, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 6 };
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

/** Each built-in category's icon and colour; white icons on these colours reach 3:1. */
const CATEGORY_LOOK: Record<string, { icon: IconName; color: string }> = {
  Makan: { icon: 'fast-food', color: '#ea580c' },
  Transport: { icon: 'car-sport', color: '#0284c7' },
  Bil: { icon: 'receipt', color: '#0d9488' },
  Rumah: { icon: 'home', color: '#16a34a' },
  Hiburan: { icon: 'film', color: '#db2777' },
  Kesihatan: { icon: 'heart', color: '#e11d48' },
  Pendidikan: { icon: 'school', color: '#d97706' },
  'Lain-lain': { icon: 'apps', color: '#64748b' },
};
const CUSTOM_LOOK = { icon: 'pricetag' as IconName, color: '#7c3aed' };

/** Icon and colour for a category; categories the user adds share a violet tag. */
export function categoryLook(name: string): { icon: IconName; color: string } {
  return CATEGORY_LOOK[name] ?? CUSTOM_LOOK;
}

const TINTS: Record<Scheme, Record<string, { bg: string; ink: string }>> = {
  light: {
    Makan: { bg: '#ffe8d2', ink: '#6b3305' },
    Transport: { bg: '#dcf1ff', ink: '#0a3a80' },
    Bil: { bg: '#d6f3ee', ink: '#0b4a42' },
    Rumah: { bg: '#e6f1d2', ink: '#34500f' },
    Hiburan: { bg: '#fde2eb', ink: '#7a1237' },
    Kesihatan: { bg: '#ffe1dc', ink: '#7a1f14' },
    Pendidikan: { bg: '#f5ebcd', ink: '#5a4207' },
    'Lain-lain': { bg: '#eef1f4', ink: '#3a3d40' },
  },
  dark: {
    Makan: { bg: '#3b2410', ink: '#ffd3a8' },
    Transport: { bg: '#12304f', ink: '#bcdcff' },
    Bil: { bg: '#0f3a35', ink: '#a9ebe0' },
    Rumah: { bg: '#26380f', ink: '#cfe8a4' },
    Hiburan: { bg: '#4a1a2b', ink: '#ffc4d6' },
    Kesihatan: { bg: '#4a1d17', ink: '#ffc7bf' },
    Pendidikan: { bg: '#3d3010', ink: '#f0dd9a' },
    'Lain-lain': { bg: '#2a2f34', ink: '#d3d7db' },
  },
};

/** Tint for a category tile; categories the user adds fall back to the neutral tint. */
export function categoryTint(name: string, scheme: Scheme): { bg: string; ink: string } {
  return TINTS[scheme][name] ?? TINTS[scheme]['Lain-lain'];
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
