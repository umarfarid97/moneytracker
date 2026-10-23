import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { Screen } from '@/ui/Screen';

export default function Commitments() {
  return (
    <Screen>
      <AppText variant="title">{t('tab.commitments')}</AppText>
    </Screen>
  );
}
