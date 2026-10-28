/**
 * The four app themes. A theme changes colours, fonts, the wallpaper and how cards are outlined; it never
 * changes layout, sizes or components. Each theme defines its own light and dark palette, so More > Appearance
 * (Light / Dark / Match device) keeps working inside every theme.
 */
import type { Status } from '@/domain/budget';

export type Scheme = 'light' | 'dark';
export type ThemeName = 'classic' | 'saas' | 'terminal' | 'notepad';
export const THEME_NAMES: readonly ThemeName[] = ['classic', 'saas', 'terminal', 'notepad'];

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
  /** Neutral tag behind a category name. */
  tagBg: string;
  tagInk: string;
  /** Faint lines of the wallpaper (ruled paper, editor grid). */
  wallpaperInk: string;
  /** Second wallpaper colour, e.g. the notepad's red margin. */
  wallpaperAccent: string;
};

export type Fonts = { regular: string; medium: string; semibold: string; bold: string };
export type Wallpaper = 'none' | 'grid' | 'ruled';
/** How a card is lifted off the ground: a soft shadow, a thin border, or both. */
export type CardChrome = 'shadow' | 'border' | 'both';
export type StatusColors = Record<Status, { bg: string; ink: string }>;

export type ThemeDef = {
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
      heroInk: '#0d5bd3', heroSoft: '#62677a', heroChip: '#e8f0fc',
      tagBg: '#eef0f3', tagInk: '#3a3f4b', wallpaperInk: 'transparent', wallpaperAccent: 'transparent',
    },
    dark: {
      ground: '#000000', surface: '#1c1c1e', raised: '#2c2c2e', border: '#38383a', control: '#48484a', track: '#2c2c2e',
      text: '#f5f5f7', muted: '#9a9aa1', accent: '#5b9bff', onAccent: '#04122b', accentSoft: '#13274a', accentInk: '#a9c8ff',
      positive: '#4fd27f', negative: '#ff8a5c', warning: '#f5b565',
      brand: ['#5b9bff', '#5b9bff'], wash: ['#000000', '#000000'],
      heroInk: '#5b9bff', heroSoft: '#9a9aa1', heroChip: '#13274a',
      tagBg: '#2a2f34', tagInk: '#d3d7db', wallpaperInk: 'transparent', wallpaperAccent: 'transparent',
    },
  },
};

/** Modern SaaS dashboard: crisp neutral greys, indigo accent, Inter, hairline borders with a whisper of shadow. */
const saas: ThemeDef = {
  fontScale: 1,
  fonts: { regular: 'Inter_400Regular', medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold', bold: 'Inter_700Bold' },
  wallpaper: 'none',
  card: { light: 'both', dark: 'border' },
  status: {
    light: {
      'on-track': { bg: '#d1fae5', ink: '#064e3b' },
      tight: { bg: '#fef3c7', ink: '#78350f' },
      over: { bg: '#fee2e2', ink: '#7f1d1d' },
    },
    dark: {
      'on-track': { bg: '#0f3a2c', ink: '#a7f3d0' },
      tight: { bg: '#3d2f0a', ink: '#fde68a' },
      over: { bg: '#471a1d', ink: '#fecaca' },
    },
  },
  palette: {
    light: {
      ground: '#f6f7f9', surface: '#ffffff', raised: '#f3f4f6', border: '#e5e7eb', control: '#d1d5db', track: '#e5e7eb',
      text: '#111827', muted: '#5b6472', accent: '#4f46e5', onAccent: '#ffffff', accentSoft: '#eef2ff', accentInk: '#3730a3',
      positive: '#047857', negative: '#dc2626', warning: '#b45309',
      brand: ['#4f46e5', '#4f46e5'], wash: ['#f6f7f9', '#f6f7f9'],
      heroInk: '#4f46e5', heroSoft: '#5b6472', heroChip: '#eef2ff',
      tagBg: '#f1f5f9', tagInk: '#334155', wallpaperInk: 'transparent', wallpaperAccent: 'transparent',
    },
    dark: {
      ground: '#0b0d12', surface: '#14171f', raised: '#1c2029', border: '#272c38', control: '#3a4150', track: '#232834',
      text: '#f3f4f6', muted: '#9aa3b2', accent: '#818cf8', onAccent: '#0b0d2e', accentSoft: '#1f2150', accentInk: '#c7d2fe',
      positive: '#34d399', negative: '#f87171', warning: '#fbbf24',
      brand: ['#818cf8', '#818cf8'], wash: ['#0b0d12', '#0b0d12'],
      heroInk: '#a5b4fc', heroSoft: '#9aa3b2', heroChip: '#1f2150',
      tagBg: '#1c2029', tagInk: '#cbd5e1', wallpaperInk: 'transparent', wallpaperAccent: 'transparent',
    },
  },
};

/** Coding interface: editor-dark ground, JetBrains Mono, green and cyan accents, 1px outlines and no shadows. */
const terminal: ThemeDef = {
  fontScale: 0.86,
  fonts: {
    regular: 'JetBrainsMono_400Regular', medium: 'JetBrainsMono_500Medium',
    semibold: 'JetBrainsMono_600SemiBold', bold: 'JetBrainsMono_700Bold',
  },
  wallpaper: 'grid',
  card: { light: 'border', dark: 'border' },
  status: {
    light: {
      'on-track': { bg: '#d3f5e2', ink: '#05301b' },
      tight: { bg: '#fdeec1', ink: '#5e3100' },
      over: { bg: '#fddcdc', ink: '#6b0f14' },
    },
    dark: {
      'on-track': { bg: '#0c3322', ink: '#7ef2b0' },
      tight: { bg: '#3a2c06', ink: '#ffd666' },
      over: { bg: '#431418', ink: '#ff9fa3' },
    },
  },
  palette: {
    light: {
      ground: '#eceff3', surface: '#fafbfc', raised: '#e4e9ee', border: '#c3ccd6', control: '#a9b6c3', track: '#d7dee6',
      text: '#0c1a14', muted: '#41505e', accent: '#047857', onAccent: '#ffffff', accentSoft: '#d5f1e5', accentInk: '#0e5f73',
      positive: '#047857', negative: '#b42318', warning: '#8a4b00',
      brand: ['#047857', '#047857'], wash: ['#eceff3', '#eceff3'],
      heroInk: '#047857', heroSoft: '#41505e', heroChip: '#d5f1e5',
      tagBg: '#dfe6ec', tagInk: '#0e5f73', wallpaperInk: '#d3dbe3', wallpaperAccent: 'transparent',
    },
    dark: {
      ground: '#0a0e13', surface: '#10171f', raised: '#16202a', border: '#223140', control: '#34495c', track: '#1b2733',
      text: '#d6e4ee', muted: '#8296a8', accent: '#2ee6a6', onAccent: '#021710', accentSoft: '#0c2e25', accentInk: '#6ee7f9',
      positive: '#4ade80', negative: '#ff6b6b', warning: '#fbbf24',
      brand: ['#2ee6a6', '#2ee6a6'], wash: ['#0a0e13', '#0a0e13'],
      heroInk: '#2ee6a6', heroSoft: '#8296a8', heroChip: '#0c2e25',
      tagBg: '#16202a', tagInk: '#6ee7f9', wallpaperInk: '#141d26', wallpaperAccent: 'transparent',
    },
  },
};

/** Notepad: cream paper with faint ruled lines, handwriting, ink-blue and pencil tones. */
const notepad: ThemeDef = {
  fontScale: 1.02,
  fonts: {
    regular: 'PatrickHand_400Regular', medium: 'PatrickHand_400Regular',
    semibold: 'Caveat_700Bold', bold: 'Caveat_700Bold',
  },
  wallpaper: 'ruled',
  card: { light: 'both', dark: 'border' },
  status: {
    light: {
      'on-track': { bg: '#dcefd2', ink: '#1d3f14' },
      tight: { bg: '#fbe9b5', ink: '#5e3a05' },
      over: { bg: '#f7d9d0', ink: '#6e1d0c' },
    },
    dark: {
      'on-track': { bg: '#2a3d24', ink: '#c5e8b8' },
      tight: { bg: '#43350f', ink: '#f2d388' },
      over: { bg: '#4a2519', ink: '#f6beaa' },
    },
  },
  palette: {
    light: {
      ground: '#f8efd4', surface: '#fffdf4', raised: '#f4e9c8', border: '#e0d1a4', control: '#cdbb86', track: '#ebdfb8',
      text: '#1f2b3d', muted: '#5a5444', accent: '#1f4e9e', onAccent: '#ffffff', accentSoft: '#e4ebf6', accentInk: '#163a78',
      positive: '#2f7a37', negative: '#b0341b', warning: '#855608',
      brand: ['#1f4e9e', '#1f4e9e'], wash: ['#f8efd4', '#f8efd4'],
      heroInk: '#1f4e9e', heroSoft: '#5a5444', heroChip: '#e4ebf6',
      tagBg: '#efe3bd', tagInk: '#3d3a2c', wallpaperInk: '#bccbe0', wallpaperAccent: '#e29a94',
    },
    dark: {
      ground: '#1d1b17', surface: '#272420', raised: '#312d27', border: '#463f35', control: '#5b5247', track: '#3a352d',
      text: '#f1e8d3', muted: '#b6aa92', accent: '#8fb4f0', onAccent: '#0b1a33', accentSoft: '#25344c', accentInk: '#c4d7f7',
      positive: '#90d08b', negative: '#f2927c', warning: '#ebc06c',
      brand: ['#8fb4f0', '#8fb4f0'], wash: ['#1d1b17', '#1d1b17'],
      heroInk: '#8fb4f0', heroSoft: '#b6aa92', heroChip: '#25344c',
      tagBg: '#38332b', tagInk: '#e6dcc4', wallpaperInk: '#2c2f3a', wallpaperAccent: '#6a3a38',
    },
  },
};

export const THEMES: Record<ThemeName, ThemeDef> = { classic, saas, terminal, notepad };
