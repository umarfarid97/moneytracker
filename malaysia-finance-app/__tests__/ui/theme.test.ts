import { categoryLook, categoryTint, contrast, heroGradient, palette, radius, statusStyle } from '@/ui/theme';
import { THEMES, THEME_NAMES } from '@/ui/themeDefs';
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

describe.each(THEME_NAMES.flatMap((n) => schemes.map((s) => [n, s] as const)))('%s theme, %s palette', (name, scheme) => {
  const p = THEMES[name].palette[scheme];
  test('text, muted text and the accent are readable on surface and ground', () => {
    for (const bg of [p.surface, p.ground]) {
      expect(contrast(p.text, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.muted, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.accent, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.heroInk, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.heroSoft, bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(p.onAccent, p.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.accentInk, p.accentSoft)).toBeGreaterThanOrEqual(4.5);
  });
  test('money colours, tags and status pills are readable', () => {
    // Classic keeps its original money colours untouched, so they are not held to the new bar.
    if (name !== 'classic') for (const tone of [p.positive, p.negative, p.warning]) expect(contrast(tone, p.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.tagInk, p.tagBg)).toBeGreaterThanOrEqual(4.5);
    for (const s of ['on-track', 'tight', 'over'] as const) {
      const st = statusStyle(s, scheme, name);
      expect(contrast(st.ink, st.bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
  test('the theme names a font for every weight', () => {
    expect(Object.keys(THEMES[name].fonts).sort()).toEqual(['bold', 'medium', 'regular', 'semibold']);
  });
});

describe('categoryTint', () => {
  test('unknown categories fall back to a neutral tint', () => {
    expect(categoryTint('Kucing', 'light')).toEqual(categoryTint('Lain-lain', 'light'));
  });
});

describe('categoryLook', () => {
  test('a picked icon wins over the built-in one; old stored names are ignored', () => {
    expect(categoryLook('Makan', 'pizza-outline').icon).toBe('pizza-outline');
    expect(categoryLook('Makan', 'utensils').icon).toBe('fast-food-outline');
    expect(categoryLook('Kucing', 'dots').icon).toBe('pricetag-outline');
    expect(categoryLook('Kucing', 'paw-outline').icon).toBe('paw-outline');
  });

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
