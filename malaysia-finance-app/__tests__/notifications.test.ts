import { NO_LOAN } from '@/domain/loanTracker';
import * as Notifications from 'expo-notifications';
import { notifyBudgetAlert, scheduleReminders } from '@/notifications';
import type { Commitment } from '@/domain/types';

jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { HIGH: 4 },
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
}));

const n = jest.mocked(Notifications);
const now = new Date('2026-10-20T04:00:00Z');
const c = (id: number, name: string, amount: number, dayOfMonth: number, active = true): Commitment => ({
  id, name, amount, dayOfMonth, kind: 'bill', active,
  categoryId: null, paymentMethodId: null, reliefId: null, autoRecord: false, startDate: null, lastAutoDue: null, variable: false, ...NO_LOAN,
});

beforeEach(() => {
  jest.clearAllMocks();
  n.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true } as never);
});

describe('scheduleReminders', () => {
  test('cancels old reminders and schedules one per active commitment', async () => {
    const list = [c(1, 'Astro', 8900, 24), c(2, 'Rumah', 120000, 1), c(3, 'Old gym', 5000, 10, false)];
    const count = await scheduleReminders(list, now);
    expect(count).toBe(6);
    expect(n.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(n.scheduleNotificationAsync).toHaveBeenCalledTimes(6);
  });

  test('rescheduling twice never doubles up', async () => {
    const list = [c(1, 'Astro', 8900, 24)];
    await scheduleReminders(list, now);
    await scheduleReminders(list, now);
    expect(n.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(2);
    expect(n.scheduleNotificationAsync).toHaveBeenCalledTimes(6);
  });

  test('a due date that is already paid gets no reminder', async () => {
    const paid = { id: 1, amount: 8900, categoryId: 1, date: '2026-10-20', note: '', receiptUri: null, paymentMethodId: null, reliefId: null, reliefAmount: null, commitmentId: 1, dueDate: '2026-10-24' };
    await scheduleReminders([c(1, 'Astro', 8900, 24)], now, 1, [paid]);
    const dates = n.scheduleNotificationAsync.mock.calls.map((x) => (x[0] as { trigger: { date: Date } }).trigger.date.toISOString());
    expect(dates).toEqual(['2026-11-23T01:00:00.000Z', '2026-12-23T01:00:00.000Z']);
  });

  test('notification says what is due, how much and when, and fires at the reminder time', async () => {
    await scheduleReminders([c(1, 'Astro', 8900, 24)], now);
    const call = n.scheduleNotificationAsync.mock.calls[0][0] as {
      content: { title: string; body: string };
      trigger: { type: string; date: Date; channelId: string };
    };
    expect(call.content.title).toBe('Astro is due tomorrow');
    expect(call.content.body).toBe('RM 89.00 is due on Sat 24 Oct.');
    expect(call.trigger.type).toBe('date');
    expect(call.trigger.date.toISOString()).toBe('2026-10-23T01:00:00.000Z');
    expect(call.trigger.channelId).toBe('reminders');
  });

  test('asks for permission when not yet granted and stops quietly when refused', async () => {
    n.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true } as never);
    n.requestPermissionsAsync.mockResolvedValue({ granted: false } as never);
    const count = await scheduleReminders([c(1, 'Astro', 8900, 24)], now);
    expect(n.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(count).toBe(0);
    expect(n.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  test('does not ask again when the user already refused for good', async () => {
    n.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false } as never);
    expect(await scheduleReminders([c(1, 'Astro', 8900, 24)], now)).toBe(0);
    expect(n.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  test('a failure in the notification system never throws into the app', async () => {
    n.scheduleNotificationAsync.mockRejectedValue(new Error('boom'));
    await expect(scheduleReminders([c(1, 'Astro', 8900, 24)], now)).resolves.toBe(0);
  });
});

describe('scheduleReminders overlapping runs (review finding: reminders fired twice)', () => {
  test('two runs started together leave exactly one reminder per active commitment', async () => {
    const scheduled: string[] = [];
    const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
    n.cancelAllScheduledNotificationsAsync.mockImplementation(async () => {
      await tick();
      scheduled.length = 0;
    });
    n.scheduleNotificationAsync.mockImplementation((async (req: { content: { title: string } }) => {
      await tick();
      scheduled.push(req.content.title);
    }) as never);
    const list = [c(1, 'TNB', 12000, 24), c(2, 'Astro', 8900, 25), c(3, 'Car', 85000, 26)];
    await Promise.all([scheduleReminders(list, now), scheduleReminders(list, now)]);
    expect([...new Set(scheduled)].sort()).toEqual(['Astro is due tomorrow', 'Car is due tomorrow', 'TNB is due tomorrow']);
    expect(scheduled).toHaveLength(9);
  });

  test('a later run replaces an earlier one that is still waiting, using the newest list', async () => {
    const scheduled: string[] = [];
    n.cancelAllScheduledNotificationsAsync.mockImplementation(async () => {
      scheduled.length = 0;
    });
    n.scheduleNotificationAsync.mockImplementation((async (req: { content: { title: string } }) => {
      scheduled.push(req.content.title);
    }) as never);
    const first = scheduleReminders([c(1, 'Old', 100, 24)], now);
    const second = scheduleReminders([c(2, 'New', 200, 24)], now);
    await Promise.all([first, second]);
    expect(scheduled).toEqual(Array(3).fill('New is due tomorrow'));
  });
});

describe('notifyBudgetAlert', () => {
  test('sends one immediate notification saying which category and how it stands', async () => {
    n.scheduleNotificationAsync.mockResolvedValue('id' as never);
    await notifyBudgetAlert('Makan', { status: 'tight', spent: 48000, limit: 60000 });
    expect(n.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const req = n.scheduleNotificationAsync.mock.calls[0][0] as { content: { title: string; body: string }; trigger: unknown };
    expect(req.trigger).toBeNull();
    expect(req.content.title).toBe('Makan is at 80% of its budget');
    expect(req.content.body).toBe('RM 120.00 left of RM 600.00.');
    await notifyBudgetAlert('Hiburan', { status: 'over', spent: 26000, limit: 20000 });
    const over = n.scheduleNotificationAsync.mock.calls[1][0] as { content: { title: string; body: string } };
    expect(over.content.title).toBe('Hiburan is over budget');
    expect(over.content.body).toBe('RM 60.00 over RM 200.00.');
  });

  test('does nothing without permission and never throws', async () => {
    n.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false } as never);
    await expect(notifyBudgetAlert('Makan', { status: 'over', spent: 2, limit: 1 })).resolves.toBeUndefined();
    expect(n.scheduleNotificationAsync).not.toHaveBeenCalled();
    n.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true } as never);
    n.scheduleNotificationAsync.mockRejectedValue(new Error('boom'));
    await expect(notifyBudgetAlert('Makan', { status: 'over', spent: 2, limit: 1 })).resolves.toBeUndefined();
  });
});

describe('scheduleReminders lead time', () => {
  const sent = () =>
    n.scheduleNotificationAsync.mock.calls[0][0] as { content: { title: string }; trigger: { date: Date } };

  test('on the due date', async () => {
    await scheduleReminders([c(1, 'Astro', 8900, 24)], now, 0);
    expect(sent().content.title).toBe('Astro is due today');
    expect(sent().trigger.date.toISOString()).toBe('2026-10-24T01:00:00.000Z');
  });

  test('several days before', async () => {
    await scheduleReminders([c(1, 'Astro', 8900, 24)], now, 3);
    expect(sent().content.title).toBe('Astro is due in 3 days');
    expect(sent().trigger.date.toISOString()).toBe('2026-10-21T01:00:00.000Z');
  });
});
