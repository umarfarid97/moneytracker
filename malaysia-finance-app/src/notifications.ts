import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { paidDueDatesFor } from '@/domain/bills';
import { nextReminderFor } from '@/domain/commitments';
import { shortDate } from '@/domain/dates';
import { formatRM } from '@/domain/money';
import type { BudgetAlert } from '@/domain/summary';
import type { Commitment, Expense } from '@/domain/types';
import { getLockState } from '@/security/appLock';
import { t } from '@/i18n/t';

const CHANNEL_ID = 'reminders';
/** How many upcoming due dates of each bill get a reminder. */
const REMINDERS_AHEAD = 3;

/** Shows reminders as banners while the app is open. Call once at start-up. */
export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => ({
      // The pinned quick-add notification stays in the shade without popping up as a banner every launch.
      shouldShowBanner: notification.request.content.data?.url !== '/add-expense',
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** True when notifications are allowed, asking the first time. */
export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

function reminderTitle(name: string, leadDays: number): string {
  if (leadDays <= 0) return t('commitments.reminder.titleToday', { name });
  if (leadDays === 1) return t('commitments.reminder.title', { name });
  return t('commitments.reminder.titleDays', { name, days: leadDays });
}

/**
 * Replaces every scheduled reminder with the next few per active commitment (09:00 KL, `leadDays` before each is due).
 * Due dates that already have a payment are skipped, so call this at launch and whenever commitments change.
 * Returns how many reminders were scheduled; never throws, because reminders are a convenience.
 */
async function replaceReminders(commitments: Commitment[], now: Date, leadDays: number, expenses: Expense[]): Promise<number> {
  try {
    const active = commitments.filter((c) => c.active);
    if (active.length === 0) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      return 0;
    }
    if (!(await ensurePermission())) return 0;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: t('commitments.reminder.channel'),
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    await Notifications.cancelAllScheduledNotificationsAsync();
    // With the app lock on, amounts stay out of the notification shade.
    const hideAmounts = getLockState().enabled;
    let scheduled = 0;
    for (const c of active) {
      const paid = new Set(paidDueDatesFor(c.id, expenses));
      let from = now;
      // The next few due dates, so reminders keep coming if the app is not opened for a while. A due date that
      // is already paid gets no reminder.
      for (let n = 0; n < REMINDERS_AHEAD; n++) {
        const next = nextReminderFor(c, from, leadDays);
        if (!next) break;
        const { dueDate, fireAt } = next;
        from = fireAt;
        if (paid.has(dueDate)) continue;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: reminderTitle(c.name, leadDays),
            body: hideAmounts
              ? t('commitments.reminder.bodyHidden', { date: shortDate(dueDate) })
              : t(c.variable ? 'commitments.reminder.bodyVariable' : 'commitments.reminder.body', {
                  amount: formatRM(c.amount),
                  date: shortDate(dueDate),
                }),
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt, channelId: CHANNEL_ID },
        });
        scheduled++;
      }
    }
    return scheduled;
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
export function scheduleReminders(commitments: Commitment[], now: Date = new Date(), leadDays = 1, expenses: Expense[] = []): Promise<number> {
  const ticket = ++latestRequest;
  const run = queue.then(() => (ticket === latestRequest ? replaceReminders(commitments, now, leadDays, expenses) : 0));
  queue = run.catch(() => undefined);
  return run;
}

/** Tells the user a category has reached 80% of its budget or gone over it. Never throws. */
export async function notifyBudgetAlert(categoryName: string, alert: BudgetAlert): Promise<void> {
  try {
    if (!(await ensurePermission())) return;
    const percent = Math.round((alert.spent * 100) / alert.limit);
    const left = alert.limit - alert.spent;
    await Notifications.scheduleNotificationAsync({
      content:
        alert.status === 'tight'
          ? {
              title: t('budget.alert.tight', { category: categoryName, percent }),
              body: getLockState().enabled ? t('budget.alert.hiddenBody') : t('budget.alert.tightBody', { left: formatRM(left), limit: formatRM(alert.limit) }),
            }
          : {
              title: t('budget.alert.over', { category: categoryName }),
              body: getLockState().enabled ? t('budget.alert.hiddenBody') : t('budget.alert.overBody', { over: formatRM(-left), limit: formatRM(alert.limit) }),
            },
      trigger: null,
    });
  } catch {
    // A missed warning is not worth failing a save for.
  }
}
