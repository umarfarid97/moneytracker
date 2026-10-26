/**
 * One-tap spending. Android can keep an "Add spending" notification in the shade (tapping it opens the Add
 * spending screen), and both platforms get a long-press home screen shortcut. A true home screen widget needs
 * a custom native build, so it is not part of the Expo app.
 */
import * as Notifications from 'expo-notifications';
import * as QuickActions from 'expo-quick-actions';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { t } from '@/i18n/t';
import { ensurePermission } from '@/notifications';
import { loadQuickAdd, saveQuickAdd } from './storage';

export const ADD_SPENDING_ROUTE = '/add-expense';
const NOTIFICATION_ID = 'quick-add';
const CHANNEL_ID = 'quick-add';
const CATEGORY_ID = 'quick-add';

/** The pinned notification only exists on Android; iPhones cannot keep a notification in place. */
export const canPinNotification = () => Platform.OS === 'android';

let enabled: boolean | undefined;
const listeners = new Set<() => void>();

export function getQuickAddEnabled(): boolean {
  if (enabled === undefined) enabled = loadQuickAdd() === 'on';
  return enabled;
}

export function setQuickAddEnabled(next: boolean): void {
  enabled = next;
  saveQuickAdd(next ? 'on' : 'off');
  listeners.forEach((l) => l());
}

export function useQuickAddEnabled(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getQuickAddEnabled,
    getQuickAddEnabled,
  );
}

/** Puts the notification in the shade (replacing any earlier copy). Resolves false if it could not be shown. */
export async function showQuickAddNotification(): Promise<boolean> {
  if (!canPinNotification()) return false;
  try {
    if (!(await ensurePermission())) return false;
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: t('quick.channel'),
      importance: Notifications.AndroidImportance.LOW,
      showBadge: false,
    });
    await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
      { identifier: 'add', buttonTitle: t('quick.title'), options: { opensAppToForeground: true } },
    ]);
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: {
        title: t('quick.title'),
        body: t('quick.body'),
        sticky: true,
        autoDismiss: false,
        categoryIdentifier: CATEGORY_ID,
        data: { url: ADD_SPENDING_ROUTE },
      },
      trigger: { channelId: CHANNEL_ID },
    });
    return true;
  } catch {
    return false;
  }
}

export async function hideQuickAddNotification(): Promise<void> {
  if (!canPinNotification()) return;
  try {
    await Notifications.dismissNotificationAsync(NOTIFICATION_ID);
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
  } catch {
    // Already gone.
  }
}

/** True when a tapped notification was the quick-add one. */
export function isQuickAddResponse(response: Notifications.NotificationResponse | null | undefined): boolean {
  const url = response?.notification.request.content.data?.url;
  return url === ADD_SPENDING_ROUTE;
}

/** Sets the long-press home screen shortcut ("Add spending"). Never throws. */
export async function setShortcuts(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (!(await QuickActions.isSupported())) return;
    await QuickActions.setItems([
      { id: 'add-spending', title: t('quick.title'), icon: Platform.OS === 'ios' ? 'add' : undefined, params: { href: ADD_SPENDING_ROUTE } },
    ]);
  } catch {
    // Shortcuts are a convenience.
  }
}

/** Calls `onOpen` when the app is opened from the shortcut (cold start or running). Returns an unsubscribe. */
export function listenForShortcut(onOpen: () => void): () => void {
  if (Platform.OS === 'web') return () => {};
  try {
    const open = (action: QuickActions.Action | null) => {
      if (action?.params?.href === ADD_SPENDING_ROUTE) onOpen();
    };
    open(QuickActions.initial ?? null);
    const sub = QuickActions.addListener(open);
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
