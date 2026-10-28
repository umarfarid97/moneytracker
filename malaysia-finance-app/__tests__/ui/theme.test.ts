import { categoryLook, categoryTint, contrast, palette, radius, statusStyle } from '@/ui/theme';
import { FONTS } from '@/ui/themeDefs';
import { t } from '@/i18n/t';

const CATEGORIES = ['Makan', 'Transport', 'Bil', 'Rumah', 'Hiburan', 'Kesihatan', 'Pendidikan', 'Lain-lain'];

describe('contrast', () => {
  test('black on white is 21:1 and identical colours are 1:1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrast('#336699', '#336699')).toBeCloseTo(1, 5);
  });
});

describe('dark green palette', () => {
  const p = palette;
  test('text, muted text and the accent are readable on cards and the ground', () => {
    for (const bg of [p.surface, p.ground, p.raised]) {
      expect(contrast(p.text, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.muted, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.accent, bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(p.accentInk, p.accentSoft)).toBeGreaterThanOrEqual(4.5);
  });
  test('primary button text is readable on the accent', () => {
    expect(contrast(p.onAccent, p.accent)).toBeGreaterThanOrEqual(4.5);
  });
  test('money colours are readable on cards', () => {
    for (const tone of [p.positive, p.negative, p.warning]) {
      expect(contrast(tone, p.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tone, p.ground)).toBeGreaterThanOrEqual(4.5);
    }
  });
  test('ink is readable on both ends of the sage summary card, and on its chips', () => {
    for (const stop of p.heroGradient) {
      expect(contrast(p.heroInk, stop)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.heroSoft, stop)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(p.heroInk, p.heroChip)).toBeGreaterThanOrEqual(4.5);
  });
  test('every category tag is readable', () => {
    for (const name of CATEGORIES) {
      const tint = categoryTint(name);
      expect(contrast(tint.ink, tint.bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
  test('every status pill is readable', () => {
    for (const s of ['on-track', 'tight', 'over'] as const) {
      const st = statusStyle(s);
      expect(contrast(st.ink, st.bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
  test('the font names a family for every weight', () => {
    expect(Object.keys(FONTS).sort()).toEqual(['bold', 'medium', 'regular', 'semibold']);
  });
});

describe('categoryTint', () => {
  test('unknown categories fall back to a neutral tint', () => {
    expect(categoryTint('Kucing')).toEqual(categoryTint('Lain-lain'));
  });
});

describe('categoryLook', () => {
  test('a picked icon wins over the built-in one; old stored names are ignored', () => {
    expect(categoryLook('Makan', 'pizza-outline').icon).toBe('pizza-outline');
    expect(categoryLook('Makan', 'utensils').icon).toBe('fast-food-outline');
    expect(categoryLook('Kucing', 'dots').icon).toBe('pricetag-outline');
    expect(categoryLook('Kucing', 'paw-outline').icon).toBe('paw-outline');
  });

  test('the category icon colour stands out (3:1) on the card', () => {
    for (const name of [...CATEGORIES, 'Kucing']) expect(contrast(categoryLook(name).color, palette.surface)).toBeGreaterThanOrEqual(3);
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
