import { t } from '@/i18n/t';

/** "Last synced 5 min ago" for the Backup & sync screen. */
export function lastSyncedText(at: number | null, now: number = Date.now()): string {
  if (at === null) return t('backup.drive.never');
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return t('backup.drive.justNow');
  if (minutes < 60) return t('backup.drive.minutesAgo', { count: minutes });
  const when = new Date(at).toLocaleString('en-MY', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  return t('backup.drive.at', { when });
}
