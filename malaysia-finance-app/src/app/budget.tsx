import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { Screen } from '@/ui/Screen';

export default function Budget() {
  return (
    <Screen>
      <AppText variant="title">{t('budget.title')}</AppText>
    </Screen>
  );
}
