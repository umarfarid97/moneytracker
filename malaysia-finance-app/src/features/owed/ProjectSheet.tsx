import { useState } from 'react';
import { View } from 'react-native';
import { isValidDate } from '@/domain/dates';
import { normalizeName, sameName, type NewOwedProject, type OwedProject } from '@/domain/owed';
import { TextField } from '@/features/wealth/TextField';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { DateField } from '@/ui/DateField';
import { Sheet } from '@/ui/Sheet';

type Props = {
  existing: OwedProject | null;
  /** People used in other projects, offered to add with one tap. */
  suggestions: string[];
  today: string;
  onClose: () => void;
  onSave: (input: NewOwedProject) => Promise<void>;
  onDelete?: () => Promise<boolean | void>;
};

/** Create or edit a project: a name, optional dates and the people in it. Mount with a fresh `key` each time. */
export function ProjectSheet({ existing, suggestions, today, onClose, onSave, onDelete }: Props) {
  const [name, setName] = useState(existing?.name ?? '');
  const [dated, setDated] = useState(existing?.startDate != null);
  const [start, setStart] = useState(existing?.startDate ?? today);
  const [end, setEnd] = useState(existing?.endDate ?? today);
  const [members, setMembers] = useState<string[]>(existing?.members ?? []);
  const [extra, setExtra] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const has = (n: string) => members.some((m) => sameName(m, n));
  function addMember(raw: string) {
    const n = normalizeName(raw);
    if (n !== '' && !has(n)) setMembers((prev) => [...prev, n]);
  }
  const datesOk = !dated || (isValidDate(start) && isValidDate(end) && end >= start);
  const valid = normalizeName(name) !== '' && datesOk;
  const offer = suggestions.filter((s) => !has(s));

  async function run(action: () => Promise<boolean | void>) {
    setBusy(true);
    setError(null);
    try {
      if ((await action()) !== false) onClose();
    } catch {
      setError(t('common.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible title={t(existing ? 'project.edit' : 'owed.newProject')} onClose={onClose}>
      <View style={{ gap: 16 }}>
        <TextField label={t('project.name')} value={name} onChange={setName} placeholder={t('project.namePlaceholder')} maxLength={40} />

        <View style={{ gap: 8 }}>
          <Chip label={t('project.dates')} selected={dated} onPress={() => setDated((d) => !d)} />
          {dated ? (
            <View style={{ gap: 8 }}>
              <AppText variant="eyebrow" tone="muted">{t('project.start')}</AppText>
              <View style={{ flexDirection: 'row' }}><DateField label={t('project.start')} value={start} onChange={setStart} /></View>
              <AppText variant="eyebrow" tone="muted">{t('project.end')}</AppText>
              <View style={{ flexDirection: 'row' }}><DateField label={t('project.end')} value={end} onChange={setEnd} /></View>
            </View>
          ) : null}
        </View>

        <View style={{ gap: 8 }}>
          <AppText variant="eyebrow" tone="muted">{t('project.people')}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {members.map((m) => (
              <Chip
                key={m}
                compact
                selected
                icon="close"
                label={m}
                accessibilityLabel={t('project.removePerson', { name: m })}
                onPress={() => setMembers((prev) => prev.filter((x) => !sameName(x, m)))}
              />
            ))}
            {offer.map((m) => (
              <Chip key={m} compact label={m} accessibilityLabel={`+ ${m}`} onPress={() => addMember(m)} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <TextField label={t('project.personName')} value={extra} onChange={setExtra} maxLength={40} />
            </View>
            <View style={{ width: 110 }}>
              <Button
                title={t('project.addPerson')}
                variant="secondary"
                disabled={normalizeName(extra) === ''}
                onPress={() => { addMember(extra); setExtra(''); }}
              />
            </View>
          </View>
        </View>

        {error ? <AppText variant="small" tone="negative">{error}</AppText> : null}
        <Button
          title={t(existing ? 'common.save' : 'project.create')}
          disabled={!valid || busy}
          onPress={() => run(() => onSave({
            name: normalizeName(name), members, owner: existing?.owner ?? '',
            startDate: dated ? start : null, endDate: dated ? end : null,
          }))}
        />
        {existing && onDelete ? (
          <Button title={t('common.delete')} variant="secondary" disabled={busy} onPress={() => run(onDelete)} />
        ) : null}
      </View>
    </Sheet>
  );
}
