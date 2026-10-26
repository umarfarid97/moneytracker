import { en, type StringKey } from './en';
import { getLanguage } from './language';
import { ms } from './ms';

const TABLES: Record<'en' | 'ms', Record<StringKey, string>> = { en, ms };

/** Looks up a string in the chosen language and fills `{name}` placeholders. */
export function t(key: StringKey, vars: Record<string, string | number> = {}): string {
  return TABLES[getLanguage()][key].replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** The locale for dates and numbers in the chosen language. */
export function dateLocale(): string {
  return getLanguage() === 'ms' ? 'ms-MY' : 'en-MY';
}
