/**
 * The one Duit look: near-black ground with a soft green light streak, charcoal rounded cards, a pale lime-mint
 * accent, a sage-green gradient summary card and Manrope type. It is dark only; there is no theme chooser.
 */
import type { Status } from '@/domain/budget';

/** Kept as a type so call sites that pass a scheme keep compiling; the app only has the dark scheme. */
export type Scheme = 'dark';

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
  /** Gradient of progress bars and other filled strokes. */
  brand: readonly [string, string];
  /** Headline figure, supporting text and divider/chip fill on the sage summary card. */
  heroInk: string;
  heroSoft: string;
  heroChip: string;
  /** Gradient of the summary card, light lime to sage. */
  heroGradient: readonly [string, string];
  /** Neutral tag behind a category name. */
  tagBg: string;
  tagInk: string;
  /** Green of the light streaks painted on the ground. */
  streak: string;
};

export type Fonts = { regular: string; medium: string; semibold: string; bold: string };
export type StatusColors = Record<Status, { bg: string; ink: string }>;

export const FONTS: Fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
};

export const PALETTE: Palette = {
  ground: '#090b0a',
  surface: '#1b1e1c',
  raised: '#262a27',
  border: '#2e332f',
  control: '#434a45',
  track: '#2f3430',
  text: '#f1f4ef',
  muted: '#9aa59d',
  accent: '#c5e9a1',
  onAccent: '#0f1d0b',
  accentSoft: '#26311f',
  accentInk: '#c5e9a1',
  positive: '#a6e3b4',
  negative: '#d9b7f5',
  warning: '#efd98e',
  brand: ['#6fb596', '#c5e9a1'],
  heroInk: '#0c1d12',
  heroSoft: '#23402f',
  heroChip: '#e6f5d8',
  heroGradient: ['#c1e5a2', '#74b99b'],
  tagBg: '#2a2f2c',
  tagInk: '#d4dcd6',
  streak: '#4f9a63',
};

export const STATUS: StatusColors = {
  'on-track': { bg: '#26402c', ink: '#c3f0cb' },
  tight: { bg: '#433b1b', ink: '#f6e5a0' },
  over: { bg: '#40294f', ink: '#ecd3fb' },
};
