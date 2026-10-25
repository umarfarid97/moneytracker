import { categoryLook, categoryTint, contrast, heroGradient, palette, radius, statusStyle } from '@/ui/theme';
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
  test('white text is readable on every stop of every hero gradient', () => {
    for (const hero of ['brand', 'ocean', 'mint', 'sunset'] as const) {
      for (const stop of heroGradient(hero, scheme)) expect(contrast('#ffffff', stop)).toBeGreaterThanOrEqual(4.5);
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

describe('categoryLook', () => {
  test('white icons stand out (3:1) on every category colour', () => {
    for (const name of [...CATEGORIES, 'Kucing']) expect(contrast('#ffffff', categoryLook(name).color)).toBeGreaterThanOrEqual(3);
  });
  test('categories the user adds share one look', () => {
    expect(categoryLook('Kucing')).toEqual(categoryLook('Anjing'));
  });
});

describe('design rules', () => {
  test('one large card radius stepping down to a capsule', () => {
    expect(radius).toEqual({ card: 22, control: 14, sm: 10, xs: 6, pill: 999 });
  });
});

describe('t', () => {
  test('looks up strings and fills placeholders', () => {
    expect(t('status.over')).toBe('Over budget');
    expect(t('home.left', { amount: 'RM 180.00' })).toBe('RM 180.00 left');
  });
});
