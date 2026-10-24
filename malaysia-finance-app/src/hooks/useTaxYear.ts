import { resolveTaxData } from '@/data/tax';
import { t } from '@/i18n/t';
import { useData } from './DataProvider';
import { useToday } from './useToday';

/**
 * The year of assessment the tax screens work on (shared by all of them). Defaults to the current year.
 * `data` holds the rates and reliefs to use, which may come from an earlier year when LHDN has not
 * published the chosen year yet; `notice` then says so.
 */
export function useTaxYear() {
  const { taxYearChoice, setTaxYearChoice } = useData();
  const current = Number(useToday().slice(0, 4));
  const year = taxYearChoice ?? current;
  const { data, exact } = resolveTaxData(year);
  return {
    year,
    setYear: setTaxYearChoice,
    options: [current, current - 1],
    data,
    notice: exact ? null : t('tax.notPublished', { year, ya: data.ya }),
  };
}
