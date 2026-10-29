import { mem } from '../test-support/securityMocks';
import { enableLock, resetLockForTests, unlock } from '@/security/appLock';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import * as QuickActions from 'expo-quick-actions';
import { Platform } from 'react-native';
import NotificationsSettings from '@/app/notifications-settings';
import { getProfile } from '@/db/repos/profile';
import { QuickAddSync } from '@/quickAdd/QuickAddSync';
import {
  getQuickAddEnabled, hideQuickAddNotification, listenForShortcut, setQuickAddEnabled, setShortcuts, showQuickAddNotification,
} from '@/quickAdd/quickAdd';
import { freshDb, renderWithData } from './screens/helpers';

jest.mock('expo-crypto', () => jest.requireActual('../test-support/securityMocks').cryptoMock());
jest.mock('@/security/lockStorage', () => jest.requireActual('../test-support/securityMocks').lockStorageMock());
jest.mock('expo-notifications', () => ({
  AndroidImportance: { LOW: 2, HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  setNotificationChannelAsync: jest.fn(),
  setNotificationCategoryAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  dismissNotificationAsync: jest.fn(),
  useLastNotificationResponse: jest.fn(() => undefined),
}));
jest.mock('expo-quick-actions', () => ({
  initial: null,
  isSupported: jest.fn(async () => true),
  setItems: jest.fn(async () => {}),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
}));

const n = jest.mocked(Notifications);
const qa = jest.mocked(QuickActions);
const { router } = jest.requireMock('expo-router');

beforeEach(() => {
  jest.clearAllMocks();
  mem.settings = null; mem.pin = null; mem.failWrite = false; resetLockForTests();
  Platform.OS = 'android';
  setQuickAddEnabled(false);
  n.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true } as never);
});

describe('quick add notification', () => {
  test('is a pinned, quiet notification that opens Add spending', async () => {
    expect(await showQuickAddNotification()).toBe(true);
    const req = n.scheduleNotificationAsync.mock.calls[0][0] as {
      identifier: string; content: Record<string, unknown>; trigger: { channelId: string };
    };
    expect(req.identifier).toBe('quick-add');
    expect(req.content).toMatchObject({ title: 'Add spending', sticky: true, autoDismiss: false, data: { url: '/add-expense' } });
    expect(req.trigger.channelId).toBe('quick-add');
    expect(n.setNotificationChannelAsync).toHaveBeenCalledWith('quick-add', expect.objectContaining({ importance: 2 }));
    expect(n.setNotificationCategoryAsync).toHaveBeenCalledWith('quick-add', [
      expect.objectContaining({ buttonTitle: 'Add spending', options: { opensAppToForeground: true } }),
    ]);
  });

  test('does nothing without permission, and never throws', async () => {
    n.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false } as never);
    expect(await showQuickAddNotification()).toBe(false);
    expect(n.scheduleNotificationAsync).not.toHaveBeenCalled();
    n.getPermissionsAsync.mockRejectedValue(new Error('boom'));
    expect(await showQuickAddNotification()).toBe(false);
  });

  test('is Android only', async () => {
    Platform.OS = 'ios';
    expect(await showQuickAddNotification()).toBe(false);
  });

  test('can be removed', async () => {
    await hideQuickAddNotification();
    expect(n.dismissNotificationAsync).toHaveBeenCalledWith('quick-add');
    expect(n.cancelScheduledNotificationAsync).toHaveBeenCalledWith('quick-add');
  });
});

describe('home screen shortcut', () => {
  test('adds "Add spending" that links to the Add spending screen', async () => {
    await setShortcuts();
    expect(qa.setItems).toHaveBeenCalledWith([
      expect.objectContaining({ title: 'Add spending', params: { href: '/add-expense' } }),
    ]);
  });

  test('opens Add spending when the shortcut is used, and ignores other actions', () => {
    const open = jest.fn();
    let handler: (a: unknown) => void = () => {};
    qa.addListener.mockImplementation(((h: (a: unknown) => void) => {
      handler = h;
      return { remove: jest.fn() };
    }) as never);
    listenForShortcut(open);
    handler({ id: 'x', title: 'x', params: { href: '/other' } });
    expect(open).not.toHaveBeenCalled();
    handler({ id: 'add-spending', title: 'Add spending', params: { href: '/add-expense' } });
    expect(open).toHaveBeenCalledTimes(1);
  });
});

describe('QuickAddSync', () => {
  test('posts the notification when the setting is on and removes it when off', async () => {
    setQuickAddEnabled(true);
    await render(<QuickAddSync />);
    await waitFor(() => expect(n.scheduleNotificationAsync).toHaveBeenCalled());
    setQuickAddEnabled(false);
    await waitFor(() => expect(n.dismissNotificationAsync).toHaveBeenCalledWith('quick-add'));
  });

  test('tapping the notification opens Add spending, but other notifications do not', async () => {
    jest.useFakeTimers();
    const response = (url?: string) =>
      ({ notification: { date: 1, request: { identifier: 'a', content: { data: url ? { url } : {} } } } }) as never;
    n.useLastNotificationResponse.mockReturnValue(response());
    await render(<QuickAddSync />);
    jest.runAllTimers();
    expect(router.push).not.toHaveBeenCalled();
    n.useLastNotificationResponse.mockReturnValue(response('/add-expense'));
    await render(<QuickAddSync />);
    jest.runAllTimers();
    expect(router.push).toHaveBeenCalledWith('/add-expense');
    jest.useRealTimers();
  });
});

describe('Reminders & quick add screen', () => {
  test('saves the reminder lead time to the profile', async () => {
    const db = await freshDb();
    await renderWithData(db, <NotificationsSettings />);
    await waitFor(() => expect(screen.getByRole('button', { name: '1 day before', selected: true })).toBeTruthy());
    await fireEvent.press(screen.getByText('3 days before'));
    await waitFor(async () => expect((await getProfile(db)).reminderDays).toBe(3));
    expect(screen.getByRole('button', { name: '3 days before', selected: true })).toBeTruthy();
  });

  test('turns quick add on once notifications are allowed', async () => {
    const db = await freshDb();
    await renderWithData(db, <NotificationsSettings />);
    await fireEvent(await screen.findByLabelText('Quick add notification'), 'valueChange', true);
    await waitFor(() => expect(getQuickAddEnabled()).toBe(true));
  });

  test('says so when notifications are blocked and leaves it off', async () => {
    n.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false } as never);
    const db = await freshDb();
    await renderWithData(db, <NotificationsSettings />);
    await fireEvent(await screen.findByLabelText('Quick add notification'), 'valueChange', true);
    await waitFor(() => expect(screen.getByText(/Allow notifications for Duit/)).toBeTruthy());
    expect(getQuickAddEnabled()).toBe(false);
  });
});

test('shortcut waits through cold lock and opens exactly once after unlock', async () => {
  jest.useFakeTimers();
  await enableLock('824613', 6); resetLockForTests();
  (QuickActions as { initial: unknown }).initial = { id: 'add-spending', title: 'Add spending', icon: undefined, subtitle: undefined, params: { href: '/add-expense' } };
  n.useLastNotificationResponse.mockReturnValue(undefined);
  await render(<QuickAddSync />);
  await act(async () => jest.runAllTimers());
  expect(router.push).not.toHaveBeenCalled();
  await act(async () => unlock());
  await act(async () => jest.runAllTimers());
  expect(router.push).toHaveBeenCalledTimes(1);
  (QuickActions as { initial: unknown }).initial = null; jest.useRealTimers();
});
