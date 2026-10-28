import { useState } from 'react';
import { Platform, View } from 'react-native';
import { useProfile } from '@/hooks/useProfile';
import { t } from '@/i18n/t';
import { ensurePermission } from '@/notifications';
import { canPinNotification, setQuickAddEnabled, useQuickAddEnabled } from '@/quickAdd/quickAdd';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { Screen } from '@/ui/Screen';
import { Toggle } from '@/ui/Toggle';

const LEAD_DAYS = [0, 1, 2, 3, 7] as const;

export default function NotificationsSettings() {
  const { data: profile, save } = useProfile();
  const quickAdd = useQuickAddEnabled();
  const [message, setMessage] = useState<string | null>(null);

  async function pickLead(days: number) {
    if (days === profile.reminderDays) return;
    setMessage(null);
    try {
      await save({ ...profile, reminderDays: days });
    } catch {
      setMessage(t('common.saveFailed'));
    }
  }

  async function toggleQuickAdd(on: boolean) {
    setMessage(null);
    if (on && !(await ensurePermission())) {
      setMessage(t('notify.quickDenied'));
      return;
    }
    setQuickAddEnabled(on);
  }

  return (
    <Screen>
      <BackButton />
      <AppText variant="title">{t('notify.title')}</AppText>

      <View style={{ gap: 8 }}>
        <AppText variant="section">{t('notify.lead')}</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {LEAD_DAYS.map((d) => (
            <Chip key={d} label={t(`notify.lead.${d}`)} selected={profile.reminderDays === d} onPress={() => pickLead(d)} />
          ))}
        </View>
        <AppText variant="small" tone="muted">{t('notify.leadHint')}</AppText>
      </View>

      <Card style={{ gap: 12 }}>
        {canPinNotification() ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{t('notify.quick')}</AppText>
              <AppText variant="small" tone="muted">{t('notify.quickHint')}</AppText>
            </View>
            <Toggle accessibilityLabel={t('notify.quick')} value={quickAdd} onValueChange={toggleQuickAdd} />
          </View>
        ) : null}
        {Platform.OS === 'ios' ? <AppText variant="small" tone="muted">{t('notify.iosNote')}</AppText> : null}
        {Platform.OS === 'web' ? (
          <AppText variant="small" tone="muted">{t('notify.webNote')}</AppText>
        ) : (
          <View>
            <AppText variant="bodyStrong">{t('notify.shortcut')}</AppText>
            <AppText variant="small" tone="muted">{t('notify.shortcutHint')}</AppText>
          </View>
        )}
        {message ? <AppText variant="small" tone="negative">{message}</AppText> : null}
      </Card>
    </Screen>
  );
}
