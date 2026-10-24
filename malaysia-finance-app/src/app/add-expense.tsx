import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { resolveTaxData } from '@/data/tax';
import { addDays, isValidDate } from '@/domain/dates';
import { parseRM, senToInput } from '@/domain/money';
import { suggestRelief } from '@/domain/reliefSpending';
import { recentTemplates } from '@/domain/spendingFilter';
import { budgetAlert } from '@/domain/summary';
import { useData } from '@/hooks/DataProvider';
import { useCategories } from '@/hooks/useCategories';
import { useExpenses } from '@/hooks/useExpenses';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { useToday } from '@/hooks/useToday';
import { t } from '@/i18n/t';
import { notifyBudgetAlert } from '@/notifications';
import { AmountInput } from '@/ui/AmountInput';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { ReceiptField } from '@/ui/ReceiptField';
import { ReliefPicker } from '@/ui/ReliefPicker';
import { Screen } from '@/ui/Screen';
import { fontFamily, radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function AddExpense() {
  const { c } = useTheme();
  const today = useToday();
  const params = useLocalSearchParams<{ id?: string }>();
  const editingId = params.id ? Number(params.id) : null;
  const { budgets } = useData();
  const { data: expenses, add, update, remove } = useExpenses();
  const { data: categories } = useCategories();
  const { data: methods } = usePaymentMethods();
  const existing = editingId !== null ? expenses.find((e) => e.id === editingId) : undefined;

  const [amountText, setAmountText] = useState('');
  const [categoryId, setCategoryId] = useState<number>(categories[0]?.id ?? 1);
  const [methodId, setMethodId] = useState<number | null>(editingId === null ? (methods[0]?.id ?? null) : null);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [reliefId, setReliefId] = useState<string | null>(null);
  const [claimText, setClaimText] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setAmountText(senToInput(existing.amount));
    setCategoryId(existing.categoryId);
    setMethodId(existing.paymentMethodId);
    setDate(existing.date);
    setNote(existing.note);
    setReliefId(existing.reliefId);
    setClaimText(existing.reliefAmount !== null ? senToInput(existing.reliefAmount) : '');
    setReceiptUri(existing.receiptUri);
    // Prefill once per expense id, not on every later edit of that expense.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  const amount = parseRM(amountText);
  // The claimable part only matters while a relief is chosen; a leftover value must not block saving.
  const claim = reliefId === null || claimText.trim() === '' ? null : parseRM(claimText);
  const claimTooBig = claim !== null && amount !== null && claim > amount;
  const claimInvalid = reliefId !== null && claimText.trim() !== '' && claim === null;
  const dateOk = isValidDate(date);
  const valid = amount !== null && amount > 0 && dateOk && !claimTooBig && !claimInvalid;

  const reliefs = useMemo(
    () => resolveTaxData(dateOk ? Number(date.slice(0, 4)) : Number(today.slice(0, 4))).data.reliefs,
    [date, dateOk, today],
  );
  const relief = reliefs.find((r) => r.id === reliefId);
  const categoryName = categories.find((cat) => cat.id === categoryId)?.name ?? '';
  const suggestedId = reliefId === null ? suggestRelief(categoryName) : null;
  const suggested = suggestedId ? reliefs.find((r) => r.id === suggestedId) : undefined;
  const recent = useMemo(() => (existing || editingId !== null ? [] : recentTemplates(expenses, 6)), [expenses, existing, editingId]);

  async function save() {
    if (!valid || amount === null || busy) return;
    setBusy(true);
    setError(null);
    const tag = reliefId
      ? { reliefId, reliefAmount: claim !== null && claim < amount ? claim : null }
      : { reliefId: null, reliefAmount: null };
    try {
      if (existing) {
        await update({ ...existing, amount, categoryId, paymentMethodId: methodId, date, note: note.trim(), receiptUri, ...tag });
      } else {
        const alert = budgetAlert({ expenses, budgets, categoryId, date, amount });
        await add({ amount, categoryId, paymentMethodId: methodId, date, note: note.trim(), receiptUri, ...tag });
        if (alert) notifyBudgetAlert(categoryName, alert).catch(() => {});
      }
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
    height: 44,
    borderRadius: radius.control,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.control,
    paddingHorizontal: 12,
    color: c.text,
    fontFamily: fontFamily.medium,
    fontSize: 16,
  } as const;
  const row = { flexDirection: 'row', flexWrap: 'wrap', gap: 6 } as const;
  const scrollRow = { flexDirection: 'row', gap: 6, paddingRight: 16 } as const;

  return (
    <Screen compact>
      <AppText variant="section">{t(existing ? 'expense.edit' : 'expense.add')}</AppText>

      {recent.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={scrollRow} keyboardShouldPersistTaps="handled" accessibilityLabel={t('recent.title')}>
          {recent.map((r) => (
            <Chip
              compact
              key={`${r.note}-${r.categoryId}`}
              label={r.note}
              accessibilityLabel={t('recent.chip', { note: r.note })}
              onPress={() => {
                setAmountText(senToInput(r.amount));
                setCategoryId(r.categoryId);
                setNote(r.note);
                setMethodId(r.paymentMethodId);
                setReliefId(r.reliefId);
                setClaimText(r.reliefAmount !== null ? senToInput(r.reliefAmount) : '');
              }}
            />
          ))}
        </ScrollView>
      ) : null}

      <AmountInput
        compact
        label={t('common.amount')}
        value={amountText}
        onChange={(text) => setAmountText(text)}
        autoFocus={!existing}
      />

      <View style={{ gap: 4 }}>
        <AppText variant="smallStrong">{t('common.category')}</AppText>
        <View style={row}>
          {categories.map((cat) => (
            <Chip compact key={cat.id} label={cat.name} selected={cat.id === categoryId} onPress={() => setCategoryId(cat.id)} />
          ))}
        </View>
        {suggested ? (
          <Chip
            compact
            label={t('relief.suggest', { name: suggested.name })}
            accessibilityLabel={t('relief.suggest', { name: suggested.name })}
            onPress={() => setReliefId(suggested.id)}
          />
        ) : null}
      </View>

      <View style={{ gap: 4 }}>
        <AppText variant="smallStrong">{t('method.field')}</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={scrollRow} keyboardShouldPersistTaps="handled">
          {methods.map((m) => (
            <Chip compact key={m.id} label={m.name} selected={m.id === methodId} onPress={() => setMethodId(m.id)} />
          ))}
        </ScrollView>
      </View>

      <View style={{ gap: 4 }}>
        <AppText variant="smallStrong">{t('common.date')}</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Chip compact label={t('expense.today')} selected={date === today} onPress={() => setDate(today)} />
          <Chip compact label={t('expense.yesterday')} selected={date === addDays(today, -1)} onPress={() => setDate(addDays(today, -1))} />
          <TextInput
            accessibilityLabel={t('common.date')}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={c.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={[field, { flex: 1, minWidth: 0, height: 36, fontSize: 14 }, !dateOk && { borderColor: c.negative }]}
          />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="smallStrong">{t('common.note')}</AppText>
          <TextInput
            accessibilityLabel={t('common.note')}
            value={note}
            onChangeText={setNote}
            placeholderTextColor={c.muted}
            style={field}
          />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="smallStrong">{t('relief.field')}</AppText>
          <ReliefPicker compact reliefs={reliefs} value={reliefId} onChange={setReliefId} />
        </View>
      </View>

      {reliefId ? (
        <View style={{ gap: 4 }}>
          <AmountInput compact label={t('relief.claimable')} value={claimText} onChange={(text) => setClaimText(text)} />
          {claimTooBig ? (
            <AppText variant="small" tone="negative">
              {t('relief.claimableTooBig')}
            </AppText>
          ) : (
            <AppText variant="small" tone="muted">
              {t('relief.claimableHint')}
            </AppText>
          )}
          {relief?.requiresReceipt && !receiptUri ? (
            <AppText variant="small" tone="warning">
              {t('relief.needsReceipt')}
            </AppText>
          ) : null}
        </View>
      ) : null}

      <ReceiptField compact uri={receiptUri} onChange={setReceiptUri} />
      {error ? (
        <AppText variant="small" tone="negative">
          {error}
        </AppText>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 2 }}>
          <Button compact title={t('common.save')} onPress={save} disabled={!valid || busy} />
        </View>
        {existing ? (
          <View style={{ flex: 1 }}>
            <Button compact title={t('common.delete')} variant="secondary" onPress={del} disabled={busy} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Button compact title={t('common.cancel')} variant="secondary" onPress={() => router.back()} />
        </View>
      </View>
    </Screen>
  );
}
