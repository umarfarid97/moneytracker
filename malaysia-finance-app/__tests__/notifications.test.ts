import * as Notifications from 'expo-notifications';
import { scheduleReminders } from '@/notifications';
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
  categoryId: null, paymentMethodId: null, reliefId: null, autoRecord: false, startDate: null, lastAutoDue: null,
});

beforeEach(() => {
  jest.clearAllMocks();
  n.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true } as never);
});

describe('scheduleReminders', () => {
  test('cancels old reminders and schedules one per active commitment', async () => {
    const list = [c(1, 'Astro', 8900, 24), c(2, 'Rumah', 120000, 1), c(3, 'Old gym', 5000, 10, false)];
    const count = await scheduleReminders(list, now);
    expect(count).toBe(2);
    expect(n.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(n.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });

  test('rescheduling twice never doubles up', async () => {
    const list = [c(1, 'Astro', 8900, 24)];
    await scheduleReminders(list, now);
    await scheduleReminders(list, now);
    expect(n.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(2);
    expect(n.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
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
    expect(scheduled.sort()).toEqual(['Astro is due tomorrow', 'Car is due tomorrow', 'TNB is due tomorrow']);
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
    expect(scheduled).toEqual(['New is due tomorrow']);
  });
});
