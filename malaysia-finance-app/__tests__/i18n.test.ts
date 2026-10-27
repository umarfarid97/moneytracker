import { en } from '@/i18n/en';
import { getLanguage, setLanguage } from '@/i18n/language';
import { ms } from '@/i18n/ms';
import { t } from '@/i18n/t';

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');

describe('i18n', () => {
  afterEach(() => setLanguage('en'));

  it('defaults to English', () => {
    expect(getLanguage()).toBe('en');
    expect(t('tab.home')).toBe('Home');
  });

  it('switches to Bahasa Malaysia and fills placeholders', () => {
    setLanguage('ms');
    expect(t('tab.home')).toBe('Utama');
    expect(t('home.left', { amount: 'RM 5' })).toBe('Baki RM 5');
  });

  it('keeps the same placeholders in every translation', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(ms[key])).toBe(placeholders(en[key]));
    }
  });
});

describe('dates and built-in names in Malay', () => {
  afterEach(() => setLanguage('en'));

  it('writes months, weekdays and today/yesterday in the chosen language', () => {
    const { dayLabel, monthLabel } = require('@/domain/dates');
    setLanguage('ms');
    expect(monthLabel('2026-10')).toBe('Oktober 2026');
    expect(dayLabel('2026-10-20', '2026-10-26')).toBe('Sel 20 Okt');
    expect(dayLabel('2026-10-26', '2026-10-26')).toBe('Hari ini');
    setLanguage('en');
    expect(dayLabel('2026-10-20', '2026-10-26')).toBe('Tue 20 Oct');
  });

  it('translates tax relief names and suggested notes, falling back to English', () => {
    const { reliefLabel, noteLabel } = require('@/i18n/content');
    setLanguage('ms');
    expect(reliefLabel({ id: 'socso', name: 'SOCSO contribution' })).toBe('Caruman PERKESO');
    expect(reliefLabel({ id: 'unknown', name: 'Something' })).toBe('Something');
    expect(noteLabel('Lunch')).toBe('Makan tengah hari');
    expect(noteLabel('Nasi lemak')).toBe('Nasi lemak');
  });

  it('translates the built-in payment methods but leaves the user\'s own names', () => {
    const { methodLabel } = require('@/i18n/content');
    setLanguage('ms');
    expect(methodLabel('Cash')).toBe('Tunai');
    expect(methodLabel('Online transfer')).toBe('Pindahan dalam talian');
    expect(methodLabel('Maybank')).toBe('Maybank');
    setLanguage('en');
    expect(methodLabel('Cash')).toBe('Cash');
  });

  it('has a Malay name for every built-in tax relief', () => {
    const { TAX_YEARS } = require('@/data/tax');
    const { reliefLabel } = require('@/i18n/content');
    setLanguage('ms');
    for (const year of Object.values(TAX_YEARS) as { reliefs: { id: string; name: string }[] }[]) {
      for (const r of year.reliefs) expect(reliefLabel(r)).not.toBe(r.name);
    }
  });
});
