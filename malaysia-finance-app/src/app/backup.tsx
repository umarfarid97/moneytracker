import { useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { useData } from '@/hooks/DataProvider';
import { dateLocale, t } from '@/i18n/t';
import { backupFileName, BackupTooNewError, createBackup, InvalidBackupError, parseBackup, restoreBackup } from '@/sync/backup';
import { pickBackupFile, saveBackupFile } from '@/sync/backupFile';
import { lastSyncedText } from '@/sync/lastSynced';
import { RECEIPT_FILES } from '@/sync/receiptFiles';
import { useSync } from '@/sync/SyncProvider';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { confirmDelete } from '@/ui/confirm';
import { IconBadge } from '@/ui/IconBadge';
import { Screen } from '@/ui/Screen';

type Note = { text: string; tone: 'positive' | 'negative' };

/** More > Backup & sync: Duit cloud sync, and a backup file to export or restore. */
export default function Backup() {
  const { db, reload } = useData();
  const sync = useSync();
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [fileNote, setFileNote] = useState<Note | null>(null);

  async function exportFile() {
    setBusy('export');
    setFileNote(null);
    try {
      await saveBackupFile(backupFileName(), await createBackup(db), t('backup.file.shareTitle'));
      setFileNote({ text: t('backup.file.exported'), tone: 'positive' });
    } catch {
      setFileNote({ text: t('backup.file.exportFailed'), tone: 'negative' });
    } finally {
      setBusy(null);
    }
  }

  async function importFile() {
    setBusy('import');
    setFileNote(null);
    try {
      const text = await pickBackupFile();
      if (text === null) return;
      const backup = await parseBackup(db, text);
      const date = new Date(backup.exportedAt).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
      const ok = await confirmDelete(
        t('backup.file.restoreTitle'), t('backup.file.restoreMessage', { date }), t('backup.file.restore'), t('common.cancel'),
      );
      if (!ok) return;
      await restoreBackup(db, backup);
      await reload();
      setFileNote({ text: t('backup.file.restored'), tone: 'positive' });
      if (sync.step === 'ready') void sync.syncNow();
    } catch (e) {
      const text =
        e instanceof InvalidBackupError ? t('backup.file.invalid')
          : e instanceof BackupTooNewError ? t('backup.file.tooNew')
            : t('backup.file.restoreFailed');
      setFileNote({ text, tone: 'negative' });
    } finally {
      setBusy(null);
    }
  }

  const status = sync.syncing ? t('backup.drive.syncing') : lastSyncedText(sync.lastSyncedAt);

  return (
    <Screen>
      <BackButton />
      <AppText variant="title">{t('backup.title')}</AppText>

      <AppText variant="section">{t('cloud.title')}</AppText>
      <Card style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconBadge icon="cloud-outline" size={36} />
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">
              {sync.email ? t('cloud.connected', { email: sync.email }) : t('cloud.title')}
            </AppText>
            {sync.step === 'ready' ? (
              <AppText variant="small" tone="muted">
                {status}
              </AppText>
            ) : null}
          </View>
        </View>
        <AppText variant="small" tone="muted">
          {!sync.available ? t('cloud.unavailable') : sync.step === 'ready' ? t('cloud.auto') : sync.step === 'off' ? t('cloud.intro') : t('cloud.finishSetup')}
        </AppText>
        {sync.step === 'ready' && sync.problem ? (
          <AppText variant="small" tone="warning">
            {t(`backup.problem.${sync.problem}`)}
          </AppText>
        ) : null}
        {sync.available ? (
          <View style={{ gap: 10 }}>
            <Button title={sync.step === 'off' ? t('cloud.setup') : t('cloud.manage')} onPress={() => router.push('/cloud')} />
            {sync.step === 'ready' ? (
              <Button title={t('backup.drive.syncNow')} variant="secondary" disabled={sync.syncing} onPress={() => void sync.syncNow()} />
            ) : null}
          </View>
        ) : null}
      </Card>

      <AppText variant="section">{t('backup.file')}</AppText>
      <Card style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconBadge icon="document-outline" size={36} />
          <AppText variant="small" tone="muted" style={{ flex: 1 }}>
            {t(RECEIPT_FILES ? 'backup.file.intro' : 'backup.file.introWeb')}
          </AppText>
        </View>
        <Button title={t('backup.file.export')} disabled={busy !== null} onPress={exportFile} />
        <Button title={t('backup.file.import')} variant="secondary" disabled={busy !== null} onPress={importFile} />
        {fileNote ? (
          <AppText variant="small" tone={fileNote.tone}>
            {fileNote.text}
          </AppText>
        ) : null}
      </Card>
    </Screen>
  );
}
