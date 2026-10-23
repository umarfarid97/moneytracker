import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { Screen } from '@/ui/Screen';

export default function AddExpense() {
  return (
    <Screen>
      <AppText variant="title">{t('expense.add')}</AppText>
    </Screen>
  );
}
