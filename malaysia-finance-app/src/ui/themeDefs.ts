/**
 * The app themes: Classic (the original look), Dark green and Pastel dark. A theme changes colours, fonts, the wallpaper and how cards are outlined; it never
 * changes layout, sizes or components. Each theme defines its own light and dark palette, so More > Appearance
 * (Light / Dark / Match device) keeps working inside every theme.
 */
import type { Status } from '@/domain/budget';

export type Scheme = 'light' | 'dark';
export type ThemeName = 'classic' | 'green' | 'pastel';
export const THEME_NAMES: readonly ThemeName[] = ['classic', 'green', 'pastel'];

export type Palette = {
  ground: string;
  surface: string;
  raised: string;
  border: string;
  control: string;
  track: string;
  text: string;
  muted: string;
  accent: string;
  onAccent: string;
  accentSoft: string;
  accentInk: string;
  positive: string;
  negative: string;
  warning: string;
  brand: readonly [string, string];
  wash: readonly [string, string];
  /** Headline figure, supporting text and divider/chip fill on a summary card. */
  heroInk: string;
  heroSoft: string;
  heroChip: string;
  /** Sage gradient behind a summary card; null keeps the plain surface card. */
  heroGradient: readonly [string, string] | null;
  /** Neutral tag behind a category name. */
  tagBg: string;
  tagInk: string;
  /** Faint lines of the wallpaper (ruled paper, editor grid). */
  wallpaperInk: string;
  /** Second wallpaper colour, unused by the current themes. */
  wallpaperAccent: string;
  /** Saturated tile fills that Home's category tiles rotate through, with `tileInk` on top; null keeps the plain surface tile. */
  tilePalette: readonly string[] | null;
  tileInk: string;
};

export type Fonts = { regular: string; medium: string; semibold: string; bold: string };
export type Wallpaper = 'none' | 'streaks' | 'vignette';
/** How a card is lifted off the ground: a soft shadow, a thin border, or both. */
export type CardChrome = 'shadow' | 'border' | 'both';
export type StatusColors = Record<Status, { bg: string; ink: string }>;

export type ThemeDef = {
  /** True when the theme has one palette only, so the Light / Dark / Match device choice does not apply. */
  darkOnly: boolean;
  fonts: Fonts;
  /** Multiplies text sizes so a wider typeface (monospace) wraps no more often than Outfit does. */
  fontScale: number;
  wallpaper: Wallpaper;
  card: Record<Scheme, CardChrome>;
  palette: Record<Scheme, Palette>;
  status: Record<Scheme, StatusColors>;
};

const CLASSIC_STATUS: Record<Scheme, StatusColors> = {
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

const classic: ThemeDef = {
  darkOnly: false,
  fontScale: 1,
  fonts: { regular: 'Outfit_400Regular', medium: 'Outfit_500Medium', semibold: 'Outfit_600SemiBold', bold: 'Outfit_700Bold' },
  wallpaper: 'none',
  card: { light: 'shadow', dark: 'border' },
  status: CLASSIC_STATUS,
  palette: {
    light: {
      ground: '#f4f5f7', surface: '#ffffff', raised: '#f6f7f9', border: '#e6e8ec', control: '#d8dce3', track: '#e9ecf1',
      text: '#111318', muted: '#62677a', accent: '#0d5bd3', onAccent: '#ffffff', accentSoft: '#e8f0fc', accentInk: '#0a47a6',
      positive: '#13a150', negative: '#d9430c', warning: '#a14a05',
      brand: ['#0d5bd3', '#0d5bd3'], wash: ['#f4f5f7', '#f4f5f7'],
      heroInk: '#0d5bd3', heroSoft: '#62677a', heroChip: '#e8f0fc', heroGradient: null,
      tagBg: '#eef0f3', tagInk: '#3a3f4b', wallpaperInk: 'transparent', wallpaperAccent: 'transparent', tilePalette: null, tileInk: '#111318',
    },
    dark: {
      ground: '#000000', surface: '#1c1c1e', raised: '#2c2c2e', border: '#38383a', control: '#48484a', track: '#2c2c2e',
      text: '#f5f5f7', muted: '#9a9aa1', accent: '#5b9bff', onAccent: '#04122b', accentSoft: '#13274a', accentInk: '#a9c8ff',
      positive: '#4fd27f', negative: '#ff8a5c', warning: '#f5b565',
      brand: ['#5b9bff', '#5b9bff'], wash: ['#000000', '#000000'],
      heroInk: '#5b9bff', heroSoft: '#9a9aa1', heroChip: '#13274a', heroGradient: null,
      tagBg: '#2a2f34', tagInk: '#d3d7db', wallpaperInk: 'transparent', wallpaperAccent: 'transparent', tilePalette: null, tileInk: '#111318',
    },
  },
};

const GREEN_STATUS: StatusColors = {
  'on-track': { bg: '#26402c', ink: '#c3f0cb' },
  tight: { bg: '#433b1b', ink: '#f6e5a0' },
  over: { bg: '#40294f', ink: '#ecd3fb' },
};

const GREEN_PALETTE: Palette = {
  ground: '#090b0a', surface: '#1b1e1c', raised: '#262a27', border: '#2e332f', control: '#434a45', track: '#2f3430',
  text: '#f1f4ef', muted: '#9aa59d', accent: '#c5e9a1', onAccent: '#0f1d0b', accentSoft: '#26311f', accentInk: '#c5e9a1',
  positive: '#a6e3b4', negative: '#d9b7f5', warning: '#efd98e',
  brand: ['#6fb596', '#c5e9a1'], wash: ['#090b0a', '#090b0a'],
  heroInk: '#0c1d12', heroSoft: '#23402f', heroChip: '#e6f5d8', heroGradient: ['#c1e5a2', '#74b99b'],
  tagBg: '#2a2f2c', tagInk: '#d4dcd6', wallpaperInk: '#4f9a63', wallpaperAccent: 'transparent', tilePalette: null, tileInk: '#0c1d12',
};

/**
 * Dark green: near-black ground with soft green light streaks, flat charcoal cards, a pale lime-mint accent, a
 * sage gradient summary card and Manrope. Dark only: the Light / Dark / Match device choice does not apply.
 */
const green: ThemeDef = {
  darkOnly: true,
  fontScale: 1,
  fonts: { regular: 'Manrope_400Regular', medium: 'Manrope_500Medium', semibold: 'Manrope_600SemiBold', bold: 'Manrope_700Bold' },
  wallpaper: 'streaks',
  card: { light: 'border', dark: 'border' },
  status: {
    light: GREEN_STATUS,
    dark: GREEN_STATUS,
  },
  palette: { light: GREEN_PALETTE, dark: GREEN_PALETTE },
};

const PASTEL_STATUS: StatusColors = {
  'on-track': { bg: '#32502d', ink: '#dcf8b4' },
  tight: { bg: '#52411a', ink: '#ffe5a0' },
  over: { bg: '#542f33', ink: '#ffcdbd' },
};

const PASTEL_PALETTE: Palette = {
  ground: '#1b1d29', surface: '#272a3a', raised: '#323650', border: '#353950', control: '#4d5270', track: '#383c54',
  text: '#f2f3f9', muted: '#a4a9c2', accent: '#aab2f0', onAccent: '#10122b', accentSoft: '#363b5e', accentInk: '#d3d8ff',
  positive: '#b9f27c', negative: '#ffb592', warning: '#ffd978',
  brand: ['#aab2f0', '#ffd978'], wash: ['#1b1d29', '#1b1d29'],
  heroInk: '#14110a', heroSoft: '#4a4120', heroChip: 'rgba(20,17,10,0.12)', heroGradient: ['#ffe27d', '#fcd861'],
  tagBg: '#353950', tagInk: '#d9dcee', wallpaperInk: '#6b5fd8', wallpaperAccent: '#3a6fd8',
  // Yellow, orange, lime, lilac and sky blue.
  tilePalette: ['#ffe27d', '#ffa66b', '#bdf26d', '#c9a7f7', '#8fd3f7'], tileInk: '#101114',
};

/**
 * Pastel dark: slate-navy ground with a soft blue-purple vignette, dark rounded cards, bold pastel tiles
 * (yellow, orange, lime, lilac, sky blue) with black ink, a grey-blue accent and Inter. Dark only.
 */
const pastel: ThemeDef = {
  darkOnly: true,
  fontScale: 1,
  fonts: { regular: 'Inter_400Regular', medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold', bold: 'Inter_700Bold' },
  wallpaper: 'vignette',
  card: { light: 'border', dark: 'border' },
  status: { light: PASTEL_STATUS, dark: PASTEL_STATUS },
  palette: { light: PASTEL_PALETTE, dark: PASTEL_PALETTE },
};

export const THEMES: Record<ThemeName, ThemeDef> = { classic, green, pastel };
