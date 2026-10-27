import { useState } from 'react';
import { View } from 'react-native';
import { formatRM, parseRM } from '@/domain/money';
import { normalizeName, sameName, splitBill, splitTransfers, type SplitBill, type SplitMode } from '@/domain/owed';
import type { Category } from '@/domain/types';
import { TextField } from '@/features/wealth/TextField';
import { t } from '@/i18n/t';
import { AmountInput } from '@/ui/AmountInput';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Sheet } from '@/ui/Sheet';
import { transferText } from './sentences';

export type SplitInput = {
  total: number;
  /** What each other person owes, in sen. */
  parts: { name: string; amount: number }[];
  /** Your own part: the total minus what the others owe. */
  mine: number;
  note: string;
  /** Who paid the bill and how much each put in ('' is you). The amounts add up to the total. */
  paid: { name: string; amount: number }[];
  /** Category to record my share as spending under, or null to record nothing. */
  categoryId: number | null;
  /** How it was split and what was typed for each of `parts`, kept so the bill can be edited. */
  mode: SplitMode;
  typed: string[];
  myShares: string;
};

type Props = {
  /** People in the project. */
  people: string[];
  categories: Category[];
  /** A bill being edited: the sheet starts with its values and does not record spending again. */
  existing?: { bill: SplitBill; note: string } | null;
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

/** Split a bill between you and friends, paid by you, one of them or several: equally, or with a different amount, percent or share for each. */
export function SplitSheet({ people, categories, existing = null, onClose, onSave }: Props) {
  const old = existing?.bill ?? null;
  const [total, setTotal] = useState(old ? (old.total / 100).toFixed(2) : '');
  const [mode, setMode] = useState<SplitMode>(old?.mode ?? 'equal');
  const [chosen, setChosen] = useState<string[]>(old ? old.parts.map((p) => p.name) : []);
  // What was typed for each person, kept per mode so switching back does not lose it.
  const [typed, setTyped] = useState<Record<string, string>>(
    old ? Object.fromEntries(old.parts.map((p, i) => [`${old.mode}|${p.name.toLowerCase()}`, old.typed[i] ?? ''])) : {},
  );
  const [myShares, setMyShares] = useState(old?.myShares ?? '1');
  const [extra, setExtra] = useState('');
  const [note, setNote] = useState(existing?.note ?? '');
  // Who paid ('' is you). With more than one payer, each types what they put in.
  const [payers, setPayers] = useState<string[]>(old ? old.paid.map((p) => p.name) : ['']);
  const [several, setSeveral] = useState((old?.paid.length ?? 1) > 1);
  const [paidTyped, setPaidTyped] = useState<Record<string, string>>(
    old && old.paid.length > 1 ? Object.fromEntries(old.paid.map((p) => [p.name.toLowerCase(), (p.amount / 100).toFixed(2)])) : {},
  );
  const [record, setRecord] = useState(false);
  const [categoryId, setCategoryId] = useState<number | null>(categories[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const known = [...people, ...chosen.filter((c) => !people.some((p) => sameName(p, c)))];
  const isChosen = (name: string) => chosen.some((c) => sameName(c, name));
  const isPayer = (name: string) => payers.some((p) => sameName(p, name));
  const toggle = (name: string) =>
    isPayer(name) ? undefined : setChosen((prev) => (isChosen(name) ? prev.filter((c) => !sameName(c, name)) : [...prev, name]));
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
  const splitOk = result !== null && result.ok;
  const paid = !several
    ? (sen !== null ? [{ name: payers[0], amount: sen }] : null)
    : payers.map((name) => ({ name, amount: parseRM(paidTyped[name.toLowerCase()] ?? '') }));
  const paidOk = paid !== null && paid.every((p) => p.amount !== null && p.amount > 0) && sen !== null
    && paid.reduce((s, p) => s + (p.amount ?? 0), 0) === sen;
  const transfers = result && splitOk && paidOk && paid
    ? splitTransfers({ paid: paid.map((p) => ({ name: p.name, amount: p.amount ?? 0 })), parts: result.parts, mine: result.mine })
    : [];
  const paidSum = several ? payers.reduce((sum, name) => sum + (parseRM(paidTyped[name.toLowerCase()] ?? '') ?? 0), 0) : sen ?? 0;
  const paidLeft = (sen ?? 0) - paidSum;
  const valid = splitOk && paidOk;
  const percentLeft = mode === 'percent' ? 100 - values.reduce<number>((s, v) => s + (v ?? 0), 0) : null;

  async function save() {
    if (!result || !valid || sen === null) return;
    setBusy(true);
    setError(null);
    try {
      await onSave({
        total: sen, parts: result.parts, mine: result.mine, note: note.trim(),
        paid: (paid ?? []).map((p) => ({ name: p.name, amount: p.amount ?? 0 })),
        categoryId: record && !old ? categoryId : null,
        mode, myShares, typed: chosen.map((name) => typed[key(name)] ?? ''),
      });
      onClose();
    } catch {
      setError(t('common.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible title={t(old ? 'bill.editTitle' : 'split.title')} onClose={onClose}
      footer={(
        <View style={{ gap: 8 }}>
          {error ? <AppText variant="small" tone="negative">{error}</AppText> : null}
          <Button title={t('split.save')} disabled={!valid || busy} onPress={save} />
        </View>
      )}
    >
      <View style={{ gap: 16 }}>
        <AmountInput label={t('split.total')} value={total} onChange={setTotal} compact autoFocus={!old} />
        <TextField label={t('split.note')} value={note} onChange={setNote} maxLength={80} />
        <View style={{ gap: 8 }}>
          <AppText variant="eyebrow" tone="muted">{t('split.billType')}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip
              compact
              label={t('split.onePaid')}
              selected={!several}
              onPress={() => {
                setSeveral(false);
                setPayers((prev) => [prev[0] ?? '']);
              }}
            />
            <Chip compact label={t('split.severalPaid')} selected={several} onPress={() => setSeveral(true)} />
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <AppText variant="eyebrow" tone="muted">{t(several ? 'split.whoPaidMany' : 'project.paidBy')}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['', ...known].map((name) => (
              <Chip
                key={name || 'me'}
                compact
                label={name === '' ? t('project.me') : name}
                accessibilityLabel={`${t('project.paidBy')} ${name === '' ? t('project.me') : name}`}
                selected={isPayer(name)}
                onPress={() => {
                  if (several && isPayer(name)) {
                    if (payers.length > 1) setPayers((prev) => prev.filter((p) => !sameName(p, name)));
                    return;
                  }
                  setPayers((prev) => (several ? [...prev, name] : [name]));
                  // Whoever paid shares the bill too.
                  if (name !== '') setChosen((prev) => (prev.some((c) => sameName(c, name)) ? prev : [...prev, name]));
                }}
              />
            ))}
          </View>
          {several ? (
            <View style={{ gap: 10 }}>
              {payers.map((name) => (
                <TextField
                  key={name || 'me'}
                  label={t('split.paidAmount', { name: name === '' ? t('project.me') : name })}
                  value={paidTyped[name.toLowerCase()] ?? ''}
                  numeric
                  decimals={2}
                  onChange={(text) => setPaidTyped((prev) => ({ ...prev, [name.toLowerCase()]: text }))}
                />
              ))}
              {sen !== null && sen > 0 ? (
                <AppText testID="split-paid-left" variant="small" tone={paidLeft === 0 ? 'positive' : paidLeft < 0 ? 'negative' : 'muted'}>
                  {paidLeft === 0 ? t('split.paidAdds') : paidLeft > 0 ? t('split.paidLeft', { amount: formatRM(paidLeft) }) : t('split.paidOver', { amount: formatRM(-paidLeft) })}
                </AppText>
              ) : null}
            </View>
          ) : null}
        </View>
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
            {!several && payers[0] === '' && mode === 'equal' ? (
              <AppText testID="split-each" variant="bodyStrong">{t('split.each', { amount: formatRM(result.parts[0]?.amount ?? 0) })}</AppText>
            ) : null}
            {transfers.map((tr, i) => (
              <AppText key={i} variant="bodyStrong">{transferText(tr)}</AppText>
            ))}
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

        {old ? null : <Chip label={t('split.recordMine')} selected={record} onPress={() => setRecord((r) => !r)} />}
        {record && !old ? (
          <View style={{ gap: 8 }}>
            <AppText variant="eyebrow" tone="muted">{t('split.category')}</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {categories.map((cat) => (
                <Chip key={cat.id} compact label={cat.name} selected={cat.id === categoryId} onPress={() => setCategoryId(cat.id)} />
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </Sheet>
  );
}
