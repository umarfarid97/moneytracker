import { Alert } from 'react-native';
import { useAppLock } from '@/security/appLock';
import { useEffect, useMemo } from 'react';
import { isPaidOff } from '@/domain/loanTracker';
import { useCommitments } from '@/hooks/useCommitments';
import { useExpenses } from '@/hooks/useExpenses';
import { useProfile } from '@/hooks/useProfile';
import { configureNotifications, scheduleReminders } from '@/notifications';

/** Keeps scheduled bill reminders in step with the saved commitments (at launch and on every change). */
export function RemindersSync() {
  const { enabled: lockEnabled } = useAppLock();
  const { data: all } = useCommitments();
  const { data: expenses } = useExpenses();
  const { reminderDays } = useProfile().data;
  // A loan that is paid off no longer needs reminders.
  const data = useMemo(() => all.filter((c) => !isPaidOff(c, expenses)), [all, expenses]);
  useEffect(() => {
    configureNotifications();
  }, []);
  useEffect(() => {
    let alive = true;
    const refresh = () => scheduleReminders(data, new Date(), reminderDays, expenses).catch(() => {
      if (!alive) return;
      Alert.alert('Reminder privacy update failed', 'Some existing notifications may still show amounts. Retry to replace them. Already delivered notifications also depend on your device notification controls.', [
        { text: 'Close', style: 'cancel' }, { text: 'Retry', onPress: () => { void refresh(); } },
      ]);
    });
    void refresh();
    return () => { alive = false; };
  }, [data, reminderDays, expenses, lockEnabled]);
  return null;
}
