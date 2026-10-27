import { useState } from 'react';
import { View } from 'react-native';
import { clearDemoData, loadDemoData } from '@/db/repos/demo';
import { todayKL } from '@/domain/dates';
import { DemoBanner } from '@/features/demo/DemoBanner';
import { useData } from '@/hooks/DataProvider';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { confirmDelete } from '@/ui/confirm';
import { Screen } from '@/ui/Screen';

/** More > Demo data: fills the app with made-up data to try every feature, and removes exactly that again. */
export default function Demo() {
  const { db, demoLoaded, reload } = useData();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; tone: 'positive' | 'negative' } | null>(null);

  async function run(action: () => Promise<void>, done: string) {
    setBusy(true);
    setNote(null);
    try {
      await action();
      await reload();
      setNote({ text: done, tone: 'positive' });
    } catch {
      setNote({ text: t('demo.failed'), tone: 'negative' });
    } finally {
      setBusy(false);
    }
  }

  async function load() {
    const ok = await confirmDelete(t('demo.loadTitle'), t('demo.loadMessage'), t('demo.load'), t('common.cancel'));
    if (ok) await run(async () => void (await loadDemoData(db, todayKL())), t('demo.loaded'));
  }

  async function clear() {
    const ok = await confirmDelete(t('demo.clearTitle'), t('demo.clearMessage'), t('demo.clear'), t('common.cancel'));
    if (ok) await run(() => clearDemoData(db), t('demo.cleared'));
  }

  return (
    <Screen>
      <BackButton />
      <AppText variant="title">{t('demo.title')}</AppText>
      <DemoBanner />
      <Card style={{ gap: 14 }}>
        <AppText variant="small" tone="muted">
          {t('demo.intro')}
        </AppText>
        <AppText variant="small" tone="muted">
          {t('demo.safe')}
        </AppText>
        <View style={{ gap: 10 }}>
          <Button title={t('demo.load')} disabled={busy || demoLoaded} onPress={() => void load()} />
          <Button title={t('demo.clear')} variant="secondary" disabled={busy || !demoLoaded} onPress={() => void clear()} />
        </View>
        {demoLoaded ? (
          <AppText variant="small" tone="warning">
            {t('demo.syncPaused')}
          </AppText>
        ) : null}
        {note ? (
          <AppText variant="small" tone={note.tone}>
            {note.text}
          </AppText>
        ) : null}
      </Card>
    </Screen>
  );
}
