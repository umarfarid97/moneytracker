/**
 * Design direction: iOS system look for a modern SaaS app.
 * - Grouped-grey ground with white (dark: elevated grey) rounded cards and soft shadows; hairline separators.
 * - iOS blue accent, SF system font with real weights, bold large titles, tabular figures for money.
 * - Capsule chips and status pills, filled primary buttons and tinted secondary buttons.
 * - Pale category tiles keep their own hue; spending is set in ink, red only for "over budget".
 * Dark mode follows iOS: true black ground, #1c1c1e cards.
 */
import { Platform, type ViewStyle } from 'react-native';
import type { Status } from '@/domain/budget';

export type Scheme = 'light' | 'dark';

export const palette = {
  light: {
    ground: '#f2f2f7',
    surface: '#ffffff',
    raised: '#f7f7fa',
    border: '#e3e3e8',
    control: '#d1d1d6',
    track: '#ececf1',
    text: '#111114',
    muted: '#66666d',
    accent: '#0a6cf0',
    onAccent: '#ffffff',
    accentSoft: '#e4efff',
    accentInk: '#0553c4',
    positive: '#1f7a3d',
    negative: '#d1242f',
    warning: '#a14a05',
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
    accent: '#3b8cff',
    onAccent: '#04122b',
    accentSoft: '#0e2a52',
    accentInk: '#9cc8ff',
    positive: '#5fd283',
    negative: '#ff7b80',
    warning: '#f5b565',
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

/** Soft iOS-style elevation for cards; dark mode relies on the lighter surface instead. */
export function elevation(scheme: Scheme): ViewStyle {
  if (scheme === 'dark') return {};
  return {
    shadowColor: '#1c2a4a',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  };
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
