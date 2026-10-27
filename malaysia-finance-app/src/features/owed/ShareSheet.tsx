import { useEffect, useState } from 'react';
import { Share, View } from 'react-native';
import { buildShare } from '@/domain/projectShare';
import type { OwedEntry, OwedProject } from '@/domain/owed';
import { TextField } from '@/features/wealth/TextField';
import { useData } from '@/hooks/DataProvider';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Sheet } from '@/ui/Sheet';

type Props = {
  project: OwedProject;
  entries: OwedEntry[];
  onClose: () => void;
};

const NAME_KEY = 'share_name';

/** Share a project's summary as text, with the data to import it appended, through the phone's share sheet. */
export function ShareSheet({ project, entries, onClose }: Props) {
  const { db } = useData();
  const [name, setName] = useState('');
  // The name you shared under last time is filled in again (kept on this phone only).
  useEffect(() => {
    db.get<{ value: string }>('SELECT value FROM sync_state WHERE key = ?', [NAME_KEY])
      .then((row) => row && setName((current) => (current === '' ? row.value : current)))
      .catch(() => {});
  }, [db]);
  const [error, setError] = useState<string | null>(null);
  const text = name.trim() === '' ? '' : buildShare(project, entries, name.trim());

  async function send() {
    setError(null);
    try {
      await db.run('INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)', [NAME_KEY, name.trim()]);
      await Share.share({ message: text });
    } catch {
      setError(t('common.saveFailed'));
    }
  }

  return (
    <Sheet visible title={t('project.shareTitle')} onClose={onClose}
      footer={(
        <View style={{ gap: 8 }}>
          {error ? <AppText variant="small" tone="negative">{error}</AppText> : null}
          <Button title={t('project.sharePay')} disabled={text === ''} onPress={send} />
        </View>
      )}
    >
      <View style={{ gap: 16 }}>
        <AppText variant="small" tone="muted">{t('project.shareHint')}</AppText>
        <TextField label={t('project.shareName')} value={name} onChange={setName} maxLength={30} />
      </View>
    </Sheet>
  );
}
