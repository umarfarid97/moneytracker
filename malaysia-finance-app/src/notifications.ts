import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { nextReminder } from '@/domain/commitments';
import { shortDate } from '@/domain/dates';
import { formatRM } from '@/domain/money';
import type { Commitment } from '@/domain/types';
import { t } from '@/i18n/t';

const CHANNEL_ID = 'reminders';

/** Shows reminders as banners while the app is open. Call once at start-up. */
export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/**
 * Replaces every scheduled reminder with one per active commitment (09:00 KL the day before it is due).
 * Only the next occurrence is scheduled, so call this at launch and whenever commitments change.
 * Returns how many reminders were scheduled; never throws, because reminders are a convenience.
 */
async function replaceReminders(commitments: Commitment[], now: Date): Promise<number> {
  try {
    const active = commitments.filter((c) => c.active);
    if (active.length === 0) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      return 0;
    }
    if (!(await ensurePermission())) return 0;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Bill reminders',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const c of active) {
      const { dueDate, fireAt } = nextReminder(c.dayOfMonth, now);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: t('commitments.reminder.title', { name: c.name }),
          body: t('commitments.reminder.body', { amount: formatRM(c.amount), date: shortDate(dueDate) }),
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt, channelId: CHANNEL_ID },
      });
    }
    return active.length;
  } catch {
    return 0;
  }
}

let queue: Promise<unknown> = Promise.resolve();
let latestRequest = 0;

/**
 * Replaces every scheduled reminder with one per active commitment (see replaceReminders).
 * Runs one at a time, and a run that is still waiting when a newer request arrives is skipped, so
 * overlapping calls (an optimistic add changes the list twice) can never leave duplicate reminders.
 */
export function scheduleReminders(commitments: Commitment[], now: Date = new Date()): Promise<number> {
  const ticket = ++latestRequest;
  const run = queue.then(() => (ticket === latestRequest ? replaceReminders(commitments, now) : 0));
  queue = run.catch(() => undefined);
  return run;
}
