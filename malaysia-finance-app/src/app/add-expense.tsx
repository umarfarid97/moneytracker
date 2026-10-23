import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { addDays, isValidDate } from '@/domain/dates';
import { parseRM, senToInput } from '@/domain/money';
import { useCategories } from '@/hooks/useCategories';
import { useExpenses } from '@/hooks/useExpenses';
import { useToday } from '@/hooks/useToday';
import { t } from '@/i18n/t';
import { AmountInput } from '@/ui/AmountInput';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { ReceiptField } from '@/ui/ReceiptField';
import { Screen } from '@/ui/Screen';
import { controlHeight, fontFamily, radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function AddExpense() {
  const { c } = useTheme();
  const today = useToday();
  const params = useLocalSearchParams<{ id?: string }>();
  const editingId = params.id ? Number(params.id) : null;
  const { data: expenses, add, update, remove } = useExpenses();
  const { data: categories } = useCategories();
  const existing = editingId !== null ? expenses.find((e) => e.id === editingId) : undefined;

  const [amountText, setAmountText] = useState('');
  const [categoryId, setCategoryId] = useState<number>(categories[0]?.id ?? 1);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setAmountText(senToInput(existing.amount));
    setCategoryId(existing.categoryId);
    setDate(existing.date);
    setNote(existing.note);
    setReceiptUri(existing.receiptUri);
    // Prefill once per expense id, not on every later edit of that expense.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  const amount = parseRM(amountText);
  const valid = amount !== null && amount > 0 && isValidDate(date);

  async function save() {
    if (!valid || amount === null || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (existing) await update({ ...existing, amount, categoryId, date, note: note.trim(), receiptUri });
      else await add({ amount, categoryId, date, note: note.trim(), receiptUri });
      router.back();
    } catch {
      setError(t('common.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!existing || busy) return;
    setBusy(true);
    try {
      await remove(existing.id);
      router.back();
    } catch {
      setError(t('common.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  const field = {
    height: controlHeight,
    borderRadius: radius.control,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.control,
    paddingHorizontal: 14,
    color: c.text,
    fontFamily: fontFamily.medium,
    fontSize: 16,
  } as const;

  return (
    <Screen>
      <AppText variant="title">{t(existing ? 'expense.edit' : 'expense.add')}</AppText>
      <AmountInput
        label={t('common.amount')}
        value={amountText}
        onChange={(text) => setAmountText(text)}
        autoFocus={!existing}
      />
      <View style={{ gap: 8 }}>
        <AppText variant="smallStrong">{t('common.category')}</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {categories.map((cat) => (
            <Chip key={cat.id} label={cat.name} selected={cat.id === categoryId} onPress={() => setCategoryId(cat.id)} />
          ))}
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <AppText variant="smallStrong">{t('common.date')}</AppText>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label={t('expense.today')} selected={date === today} onPress={() => setDate(today)} />
          <Chip label={t('expense.yesterday')} selected={date === addDays(today, -1)} onPress={() => setDate(addDays(today, -1))} />
        </View>
        <TextInput
          accessibilityLabel={t('common.date')}
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={c.muted}
          autoCapitalize="none"
          autoCorrect={false}
          style={[field, !isValidDate(date) && { borderColor: c.negative }]}
        />
      </View>
      <View style={{ gap: 8 }}>
        <AppText variant="smallStrong">{t('common.note')}</AppText>
        <TextInput
          accessibilityLabel={t('common.note')}
          value={note}
          onChangeText={setNote}
          placeholderTextColor={c.muted}
          style={field}
        />
      </View>
      <ReceiptField uri={receiptUri} onChange={setReceiptUri} />
      {error ? (
        <AppText variant="small" tone="negative">
          {error}
        </AppText>
      ) : null}
      <Button title={t('common.save')} onPress={save} disabled={!valid || busy} />
      {existing ? <Button title={t('common.delete')} variant="secondary" onPress={del} disabled={busy} /> : null}
      <Button title={t('common.cancel')} variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
