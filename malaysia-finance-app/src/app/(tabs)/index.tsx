import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { Screen } from '@/ui/Screen';

export default function Home() {
  return (
    <Screen>
      <AppText variant="title">{t('tab.home')}</AppText>
    </Screen>
  );
}
