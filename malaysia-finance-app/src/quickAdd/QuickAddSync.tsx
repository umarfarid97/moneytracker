import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { getLockState, useAppLock } from '@/security/appLock';
import { useCallback, useEffect, useRef } from 'react';
import { useLanguage } from '@/i18n/language';
import {
  hideQuickAddNotification, isQuickAddResponse, listenForShortcut, setShortcuts, showQuickAddNotification,
  useQuickAddEnabled, ADD_SPENDING_ROUTE,
} from './quickAdd';

/** Keeps the quick-add notification and home screen shortcut in step with the setting and the language. */
export function QuickAddSync() {
  const { locked } = useAppLock();
  const pending = useRef(false);
  const openAddSpending = useCallback(() => {
    pending.current = true;
    setTimeout(() => {
      if (!pending.current || getLockState().locked) return;
      try { router.push(ADD_SPENDING_ROUTE); pending.current = false; } catch { /* Navigator not ready. */ }
    });
  }, []);
  useEffect(() => { if (!locked && pending.current) openAddSpending(); }, [locked, openAddSpending]);
  const enabled = useQuickAddEnabled();
  const language = useLanguage();
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    setShortcuts();
  }, [language]);

  useEffect(() => listenForShortcut(openAddSpending), [openAddSpending]);

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
  }, [response, openAddSpending]);

  return null;
}
