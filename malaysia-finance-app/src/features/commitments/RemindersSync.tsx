import { useEffect } from 'react';
import { useCommitments } from '@/hooks/useCommitments';
import { configureNotifications, scheduleReminders } from '@/notifications';

/** Keeps scheduled bill reminders in step with the saved commitments (at launch and on every change). */
export function RemindersSync() {
  const { data } = useCommitments();
  useEffect(() => {
    configureNotifications();
  }, []);
  useEffect(() => {
    scheduleReminders(data).catch(() => {});
  }, [data]);
  return null;
}
