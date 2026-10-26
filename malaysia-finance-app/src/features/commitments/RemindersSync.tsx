import { useEffect, useMemo } from 'react';
import { isPaidOff } from '@/domain/loanTracker';
import { useCommitments } from '@/hooks/useCommitments';
import { useExpenses } from '@/hooks/useExpenses';
import { configureNotifications, scheduleReminders } from '@/notifications';

/** Keeps scheduled bill reminders in step with the saved commitments (at launch and on every change). */
export function RemindersSync() {
  const { data: all } = useCommitments();
  const { data: expenses } = useExpenses();
  // A loan that is paid off no longer needs reminders.
  const data = useMemo(() => all.filter((c) => !isPaidOff(c, expenses)), [all, expenses]);
  useEffect(() => {
    configureNotifications();
  }, []);
  useEffect(() => {
    scheduleReminders(data).catch(() => {});
  }, [data]);
  return null;
}
