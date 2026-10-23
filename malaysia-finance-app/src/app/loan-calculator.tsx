import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Screen } from '@/ui/Screen';

export default function LoanCalculator() {
  return (
    <Screen>
      <BackButton />
      <AppText variant="title">{t('loan.title')}</AppText>
    </Screen>
  );
}
