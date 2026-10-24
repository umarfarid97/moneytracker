import { categoryTint, contrast, palette, radius, statusStyle } from '@/ui/theme';
import { t } from '@/i18n/t';

const schemes = ['light', 'dark'] as const;
const CATEGORIES = ['Makan', 'Transport', 'Bil', 'Rumah', 'Hiburan', 'Kesihatan', 'Pendidikan', 'Lain-lain'];

describe('contrast', () => {
  test('black on white is 21:1 and identical colours are 1:1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrast('#336699', '#336699')).toBeCloseTo(1, 5);
  });
});

describe.each(schemes)('%s palette', (scheme) => {
  const p = palette[scheme];
  test('body text and muted text are readable on surface and ground', () => {
    expect(contrast(p.text, p.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.text, p.ground)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.muted, p.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.muted, p.ground)).toBeGreaterThanOrEqual(4.5);
  });
  test('primary button text is readable on the accent', () => {
    expect(contrast(p.onAccent, p.accent)).toBeGreaterThanOrEqual(4.5);
  });
  test('every category tile ink is readable on its tint', () => {
    for (const name of CATEGORIES) {
      const tint = categoryTint(name, scheme);
      expect(contrast(tint.ink, tint.bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
  test('every status pill is readable', () => {
    for (const s of ['on-track', 'tight', 'over'] as const) {
      const st = statusStyle(s, scheme);
      expect(contrast(st.ink, st.bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('categoryTint', () => {
  test('unknown categories fall back to a neutral tint', () => {
    expect(categoryTint('Kucing', 'light')).toEqual(categoryTint('Lain-lain', 'light'));
  });
});

describe('design rules', () => {
  test('one large card radius stepping down', () => {
    expect(radius).toEqual({ card: 20, control: 10, sm: 8, xs: 5 });
  });
});

describe('t', () => {
  test('looks up strings and fills placeholders', () => {
    expect(t('status.over')).toBe('Over budget');
    expect(t('home.left', { amount: 'RM 180.00' })).toBe('RM 180.00 left');
  });
});
