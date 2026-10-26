import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { importAs, parseShare, whoCanIBe } from '@/domain/projectShare';
import type { NewOwedEntry, NewOwedProject } from '@/domain/owed';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Sheet } from '@/ui/Sheet';
import { fontFamily, radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

type Props = {
  onClose: () => void;
  onImport: (project: NewOwedProject, entries: Omit<NewOwedEntry, 'projectId'>[]) => Promise<void>;
};

/** Paste a project a friend shared, say who you are in it, and it is added from your point of view. */
export function ImportSheet({ onClose, onImport }: Props) {
  const { c } = useTheme();
  const [text, setText] = useState('');
  const [me, setMe] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shared = useMemo(() => parseShare(text), [text]);
  const options = shared ? whoCanIBe(shared) : [];

  async function run() {
    if (!shared || me === null) return;
    setBusy(true);
    setError(null);
    try {
      const { project, entries } = importAs(shared, me);
      await onImport(project, entries);
      onClose();
    } catch {
      setError(t('common.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible title={t('project.import.title')} onClose={onClose}>
      <View style={{ gap: 16 }}>
        <AppText variant="small" tone="muted">{t('project.import.hint')}</AppText>
        <TextInput
          accessibilityLabel={t('project.import.paste')}
          value={text}
          onChangeText={(v) => { setText(v); setMe(null); }}
          multiline
          placeholder={t('project.import.paste')}
          placeholderTextColor={c.control}
          style={{
            minHeight: 110, maxHeight: 200, borderRadius: radius.control, backgroundColor: c.surface, borderWidth: 1.5,
            borderColor: c.border, padding: 12, color: c.text, fontFamily: fontFamily.medium, fontSize: 14, textAlignVertical: 'top',
          }}
        />
        {text.trim() !== '' && !shared ? <AppText variant="small" tone="negative">{t('project.import.invalid')}</AppText> : null}
        {shared ? (
          <View style={{ gap: 8 }}>
            <AppText variant="bodyStrong">{shared.name}</AppText>
            <AppText variant="small" tone="muted">{t('project.import.from', { name: shared.owner })}</AppText>
            <AppText variant="eyebrow" tone="muted">{t('project.import.who')}</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {options.map((o) => (
                <Chip key={o} compact label={o} accessibilityLabel={`${t('project.import.who')} ${o}`} selected={me === o} onPress={() => setMe(o)} />
              ))}
            </View>
          </View>
        ) : null}
        {error ? <AppText variant="small" tone="negative">{error}</AppText> : null}
        <Button title={t('project.import.button')} disabled={!shared || me === null || busy} onPress={run} />
      </View>
    </Sheet>
  );
}
