import { useState } from 'react';
import { View } from 'react-native';
import { formatRM, parseRM } from '@/domain/money';
import { normalizeName, sameName, splitBill, type SplitMode } from '@/domain/owed';
import type { Category } from '@/domain/types';
import { TextField } from '@/features/wealth/TextField';
import { t } from '@/i18n/t';
import { AmountInput } from '@/ui/AmountInput';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Sheet } from '@/ui/Sheet';

export type SplitInput = {
  total: number;
  /** What each other person owes, in sen. */
  parts: { name: string; amount: number }[];
  /** Your own part: the total minus what the others owe. */
  mine: number;
  note: string;
  /** Who paid the bill: null when you did, otherwise one of the people (you then owe them your part). */
  payer: string | null;
  /** Category to record my share as spending under, or null to record nothing. */
  categoryId: number | null;
};

type Props = {
  /** People in the project. */
  people: string[];
  categories: Category[];
  onClose: () => void;
  onSave: (input: SplitInput) => Promise<void>;
};

const MODES: SplitMode[] = ['equal', 'amount', 'percent', 'shares'];

/** Number typed for one person: sen for amounts, a plain number for percent and shares. Null when empty or invalid. */
function valueOf(mode: SplitMode, text: string): number | null {
  if (text.trim() === '') return null;
  if (mode === 'amount') return parseRM(text);
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Split a bill you paid between you and friends: equally, or with a different amount, percent or share for each. */
export function SplitSheet({ people, categories, onClose, onSave }: Props) {
  const [total, setTotal] = useState('');
  const [mode, setMode] = useState<SplitMode>('equal');
  const [chosen, setChosen] = useState<string[]>([]);
  // What was typed for each person, kept per mode so switching back does not lose it.
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [myShares, setMyShares] = useState('1');
  const [extra, setExtra] = useState('');
  const [note, setNote] = useState('');
  const [payer, setPayer] = useState<string | null>(null);
  const [record, setRecord] = useState(false);
  const [categoryId, setCategoryId] = useState<number | null>(categories[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const known = [...people, ...chosen.filter((c) => !people.some((p) => sameName(p, c)))];
  const isChosen = (name: string) => chosen.some((c) => sameName(c, name));
  const toggle = (name: string) =>
    payer !== null && sameName(payer, name) ? undefined : setChosen((prev) => (isChosen(name) ? prev.filter((c) => !sameName(c, name)) : [...prev, name]));
  const key = (name: string) => `${mode}|${name.toLowerCase()}`;

  function addExtra() {
    const name = normalizeName(extra);
    if (name !== '' && !isChosen(name)) setChosen((prev) => [...prev, name]);
    setExtra('');
  }

  const sen = parseRM(total);
  const values = chosen.map((name) => valueOf(mode, typed[key(name)] ?? ''));
  const sharesMine = valueOf('shares', myShares);
  const result =
    sen !== null && sen > 0 && chosen.length > 0 && (mode === 'equal' || values.every((v) => v !== null)) && (mode !== 'shares' || (sharesMine !== null && sharesMine > 0))
      ? splitBill({
          total: sen, mode, myShares: sharesMine ?? 1,
          others: chosen.map((name, i) => ({ name, value: values[i] ?? 0 })),
        })
      : null;
  const valid = result !== null && result.ok;
  const percentLeft = mode === 'percent' ? 100 - values.reduce<number>((s, v) => s + (v ?? 0), 0) : null;

  async function save() {
    if (!result || !valid || sen === null) return;
    setBusy(true);
    setError(null);
    try {
      await onSave({
        total: sen, parts: result.parts, mine: result.mine, note: note.trim(), payer,
        categoryId: record ? categoryId : null,
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
        {people.length > 0 ? (
          <View style={{ gap: 8 }}>
            <AppText variant="eyebrow" tone="muted">{t('project.paidBy')}</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Chip compact label={t('project.me')} selected={payer === null} onPress={() => setPayer(null)} />
              {people.map((name) => (
                <Chip
                  key={name}
                  compact
                  label={name}
                  accessibilityLabel={`${t('project.paidBy')} ${name}`}
                  selected={payer !== null && sameName(payer, name)}
                  onPress={() => {
                    setPayer(name);
                    // Whoever paid shares the bill too.
                    setChosen((prev) => (prev.some((c) => sameName(c, name)) ? prev : [...prev, name]));
                  }}
                />
              ))}
            </View>
            {payer !== null ? <AppText variant="small" tone="muted">{t('project.paidByOther', { name: payer })}</AppText> : null}
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

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {MODES.map((m) => (
            <Chip key={m} compact label={t(`split.mode.${m}`)} selected={mode === m} onPress={() => setMode(m)} />
          ))}
        </View>

        {mode !== 'equal' && chosen.length > 0 ? (
          <View style={{ gap: 10 }}>
            {chosen.map((name) => (
              <TextField
                key={name}
                label={t(`split.value.${mode}`, { name })}
                value={typed[key(name)] ?? ''}
                numeric
                decimals={2}
                onChange={(text) => setTyped((prev) => ({ ...prev, [key(name)]: text }))}
              />
            ))}
            {mode === 'shares' ? (
              <TextField label={t('split.myShares')} value={myShares} numeric decimals={2} onChange={setMyShares} />
            ) : null}
          </View>
        ) : null}

        {result ? (
          <View style={{ gap: 2 }}>
            {payer !== null ? null : mode === 'equal' ? (
              <AppText testID="split-each" variant="bodyStrong">{t('split.each', { amount: formatRM(result.parts[0]?.amount ?? 0) })}</AppText>
            ) : (
              result.parts.map((p) => (
                <AppText key={p.name} variant="bodyStrong">{t('split.owes', { name: p.name, amount: formatRM(p.amount) })}</AppText>
              ))
            )}
            {result.mine >= 0 ? (
              <AppText testID="split-mine" variant="small" tone="muted">
                {mode === 'equal' || mode === 'shares' ? t('split.mine', { amount: formatRM(result.mine) }) : t('split.left', { amount: formatRM(result.mine) })}
              </AppText>
            ) : (
              <AppText testID="split-mine" variant="small" tone="negative">{t('split.over', { amount: formatRM(-result.mine) })}</AppText>
            )}
            {percentLeft !== null && percentLeft >= 0 ? (
              <AppText variant="small" tone="muted">{t('split.percentLeft', { percent: Number(percentLeft.toFixed(2)) })}</AppText>
            ) : null}
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
