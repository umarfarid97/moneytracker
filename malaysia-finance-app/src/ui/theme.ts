/**
 * Design direction (design-taste-frontend, app style "Pastel consumer"):
 * - Pale category tiles; ink is the dark of the tile's own hue. Tints only on tiles, chips and marks;
 *   panels that hold lists stay on the plain surface.
 * - One large card radius (20) stepping down to 10, 8, 5. No shadows or gradients on anything at rest.
 * - Manrope 400/500/600, tabular figures for money. Sentence case, no tracked capitals.
 * - Spending is set in ink, never red; red appears only for an "over budget" status.
 * - One gap value (16) horizontally and vertically; page padding 20.
 * Dark mode keeps the same structure with darkened tints and lightened inks.
 */
import type { Status } from '@/domain/budget';

export type Scheme = 'light' | 'dark';

export const palette = {
  light: {
    ground: '#f3f5f7',
    surface: '#ffffff',
    raised: '#f2f8fd',
    border: '#e6e6e6',
    control: '#d6d9dd',
    track: '#e7eaee',
    text: '#1b1d1f',
    muted: '#5c6064',
    accent: '#1d5fd6',
    onAccent: '#ffffff',
    accentSoft: '#dcf1ff',
    accentInk: '#0a3a80',
    positive: '#2f7a45',
    negative: '#c41c29',
    warning: '#92400e',
  },
  dark: {
    ground: '#0e1113',
    surface: '#171a1d',
    raised: '#1d2125',
    border: '#2a2f34',
    control: '#3a4046',
    track: '#2a2f34',
    text: '#eef0f2',
    muted: '#a3a9af',
    accent: '#7db1ff',
    onAccent: '#0b1a33',
    accentSoft: '#12304f',
    accentInk: '#bcdcff',
    positive: '#6cc58a',
    negative: '#ff8a8f',
    warning: '#f0b36a',
  },
} as const;

export type Palette = (typeof palette)[Scheme];

export const radius = { card: 20, control: 10, sm: 8, xs: 5 } as const;
export const space = { xs: 4, s: 8, m: 12, gap: 16, pad: 20, xl: 24, xxl: 32 } as const;
export const controlHeight = 48;

export const fontFamily = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
} as const;

export const fontSize = { title: 28, section: 20, kpi: 32, body: 16, small: 14 } as const;

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
