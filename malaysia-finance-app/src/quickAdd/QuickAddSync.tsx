import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { useLanguage } from '@/i18n/language';
import {
  hideQuickAddNotification, isQuickAddResponse, listenForShortcut, setShortcuts, showQuickAddNotification,
  useQuickAddEnabled, ADD_SPENDING_ROUTE,
} from './quickAdd';

const openAddSpending = () => {
  // After the current tick, so the navigator exists when the app was opened cold from the shortcut.
  setTimeout(() => {
    try {
      router.push(ADD_SPENDING_ROUTE);
    } catch {
      // Navigator not ready: the person lands on Home and can tap + instead.
    }
  });
};

/** Keeps the quick-add notification and home screen shortcut in step with the setting and the language. */
export function QuickAddSync() {
  const enabled = useQuickAddEnabled();
  const language = useLanguage();
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    setShortcuts();
  }, [language]);

  useEffect(() => listenForShortcut(openAddSpending), []);

  useEffect(() => {
    if (enabled) showQuickAddNotification().catch(() => {});
    else hideQuickAddNotification().catch(() => {});
  }, [enabled, language]);

  // Tapping the notification (or its button) opens Add spending, once per tap.
  useEffect(() => {
    if (!response || !isQuickAddResponse(response)) return;
    const id = `${response.notification.request.identifier}:${response.notification.date}`;
    if (handled.current === id) return;
    handled.current = id;
    openAddSpending();
  }, [response]);

  return null;
}
