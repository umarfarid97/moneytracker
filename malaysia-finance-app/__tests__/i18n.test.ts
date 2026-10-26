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
    expect(t('home.left', { amount: 'RM 5' })).toBe('RM 5 berbaki');
  });

  it('keeps the same placeholders in every translation', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(ms[key])).toBe(placeholders(en[key]));
    }
  });
});
