import { useState } from 'react';
import { View } from 'react-native';
import { formatRM, parseRM } from '@/domain/money';
import { normalizeName, splitByAmounts, splitEqually } from '@/domain/owed';
import { TextField } from '@/features/wealth/TextField';
import { t } from '@/i18n/t';
import { AmountInput } from '@/ui/AmountInput';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Sheet } from '@/ui/Sheet';
import type { Category } from '@/domain/types';

export type SplitInput = {
  total: number;
  others: string[];
  note: string;
  /** The occasion this bill belongs to, or empty. */
  event: string;
  /** What each person owes, by name, when the bill isn't split equally. */
  amounts?: Record<string, number>;
  /** Category to record my share as spending under, or null to record nothing. */
  categoryId: number | null;
};

type Props = {
  people: string[];
  /** Events used before, offered as chips. */
  events: string[];
  categories: Category[];
  onClose: () => void;
  onSave: (input: SplitInput) => Promise<void>;
};

/** Split a bill you paid with friends: equally, or with a different amount for each person. */
export function SplitSheet({ people, events, categories, onClose, onSave }: Props) {
  const [total, setTotal] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [extra, setExtra] = useState('');
  const [note, setNote] = useState('');
  const [event, setEvent] = useState('');
  const [custom, setCustom] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [record, setRecord] = useState(false);
  const [categoryId, setCategoryId] = useState<number | null>(categories[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const known = [...people, ...chosen.filter((c) => !people.some((p) => p.toLowerCase() === c.toLowerCase()))];
  const isChosen = (name: string) => chosen.some((c) => c.toLowerCase() === name.toLowerCase());
  const toggle = (name: string) =>
    setChosen((prev) => (isChosen(name) ? prev.filter((c) => c.toLowerCase() !== name.toLowerCase()) : [...prev, name]));

  function addExtra() {
    const name = normalizeName(extra);
    if (name !== '' && !isChosen(name)) setChosen((prev) => [...prev, name]);
    setExtra('');
  }

  const sen = parseRM(total);
  const given = Object.fromEntries(chosen.map((name) => [name, parseRM(amounts[name] ?? '') ?? 0]));
  const equal = sen !== null ? splitEqually(sen, chosen) : { share: 0, mine: 0 };
  const byAmount = sen !== null ? splitByAmounts(sen, chosen.map((person) => ({ person, amount: given[person] }))) : null;
  const mine = custom ? byAmount?.mine ?? 0 : equal.mine;
  const valid = sen !== null && sen > 0 && chosen.length > 0
    && (custom ? byAmount !== null && byAmount.shares.length > 0 : equal.share > 0);
  const unequalOver = custom && sen !== null && byAmount === null;

  async function save() {
    if (!valid || sen === null) return;
    setBusy(true);
    setError(null);
    try {
      await onSave({
        total: sen, others: chosen, note: note.trim(), event: normalizeName(event),
        amounts: custom ? given : undefined, categoryId: record ? categoryId : null,
      });
      onClose();
    } catch {
      setError(t('common.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible title={t('split.title')} onClose={onClose}>
      <View style={{ gap: 16 }}>
        <AmountInput label={t('split.total')} value={total} onChange={setTotal} compact autoFocus />
        <TextField label={t('split.note')} value={note} onChange={setNote} maxLength={80} />
        <TextField label={t('owed.event')} value={event} onChange={setEvent} maxLength={40} />
        {events.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {events.map((name) => (
              <Chip key={name} compact label={name} selected={normalizeName(event).toLowerCase() === name.toLowerCase()} onPress={() => setEvent(name)} />
            ))}
          </View>
        ) : null}
        <View style={{ gap: 8 }}>
          <AppText variant="eyebrow" tone="muted">{t('split.with')}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {known.map((name) => (
              <Chip key={name} compact label={name} selected={isChosen(name)} onPress={() => toggle(name)} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <TextField label={t('split.namePlaceholder')} value={extra} onChange={setExtra} maxLength={40} />
            </View>
            <View style={{ width: 130 }}>
              <Button title={t('split.addPerson')} variant="secondary" disabled={normalizeName(extra) === ''} onPress={addExtra} />
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label={t('split.equal')} selected={!custom} onPress={() => setCustom(false)} />
          <Chip label={t('split.custom')} selected={custom} onPress={() => setCustom(true)} />
        </View>
        {custom && chosen.length > 0 ? (
          <View style={{ gap: 8 }}>
            {chosen.map((name) => (
              <AmountInput
                key={name}
                label={t('split.owes', { name })}
                value={amounts[name] ?? ''}
                onChange={(v) => setAmounts((prev) => ({ ...prev, [name]: v }))}
                compact
              />
            ))}
          </View>
        ) : null}
        {sen !== null && sen > 0 && chosen.length > 0 ? (
          <View style={{ gap: 2 }}>
            {custom ? null : <AppText testID="split-each" variant="bodyStrong">{t('split.each', { amount: formatRM(equal.share) })}</AppText>}
            {unequalOver ? (
              <AppText testID="split-over" variant="small" tone="negative">{t('split.over')}</AppText>
            ) : (
              <AppText testID="split-mine" variant="small" tone="muted">{t('split.mine', { amount: formatRM(mine) })}</AppText>
            )}
          </View>
        ) : (
          <AppText variant="small" tone="muted">{t('split.needPeople')}</AppText>
        )}
        <Chip label={t('split.recordMine')} selected={record} onPress={() => setRecord((r) => !r)} />
        {record ? (
          <View style={{ gap: 8 }}>
            <AppText variant="eyebrow" tone="muted">{t('split.category')}</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {categories.map((cat) => (
                <Chip key={cat.id} compact label={cat.name} selected={cat.id === categoryId} onPress={() => setCategoryId(cat.id)} />
              ))}
            </View>
          </View>
        ) : null}
        {error ? <AppText variant="small" tone="negative">{error}</AppText> : null}
        <Button title={t('split.save')} disabled={!valid || busy} onPress={save} />
      </View>
    </Sheet>
  );
}
