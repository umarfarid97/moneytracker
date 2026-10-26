import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { resolveTaxData } from '@/data/tax';
import { addDays, isValidDate } from '@/domain/dates';
import { formatRM, parseRM, senToInput } from '@/domain/money';
import { suggestRelief } from '@/domain/reliefSpending';
import type { ReceiptScan } from '@/domain/receiptText';
import { scanReceipt } from '@/receiptScan';
import { noteSuggestions, type NoteSuggestion } from '@/domain/spendingFilter';
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
import { Card } from '@/ui/Card';
import { ExpenseDetails } from '@/features/spending/ExpenseDetails';
import { Chip } from '@/ui/Chip';
import { confirmDelete } from '@/ui/confirm';
import { DateField } from '@/ui/DateField';
import { MethodBadge } from '@/ui/MethodBadge';
import { ReceiptField } from '@/ui/ReceiptField';
import { ReliefPicker } from '@/ui/ReliefPicker';
import { Screen } from '@/ui/Screen';
import { categoryLook, fontFamily, radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function AddExpense() {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  // Tablets and wide windows get a two-column layout that fills the screen.
  const wide = width >= 700;
  const today = useToday();
  const params = useLocalSearchParams<{ id?: string }>();
  const editingId = params.id ? Number(params.id) : null;
  const { budgets, profile } = useData();
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
  const [sst, setSst] = useState<number | null>(null);
  // Receipt scan: while it runs, and what it found (shown under the photo).
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'found' | 'none'>('idle');
  const [scanned, setScanned] = useState<ReceiptScan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Saved spending opens read-only; Edit switches to the form.
  const [editMode, setEditMode] = useState(editingId === null);

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
    setSst(existing.sst ?? null);
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
  // While editing, suggestions only appear once the note is changed, so an untouched form stays calm.
  const [noteTouched, setNoteTouched] = useState(false);
  const suggestions = useMemo(
    () => (editingId !== null && !noteTouched ? [] : noteSuggestions(note, expenses, 6)),
    [note, expenses, editingId, noteTouched],
  );

  function pickSuggestion(s: NoteSuggestion) {
    setNote(s.note);
    if (s.kind === 'default') {
      const cat = categories.find((x) => x.name === s.category);
      if (cat) setCategoryId(cat.id);
      return;
    }
    const r = s.template;
    // The amount comes first now: keep one that was already typed.
    if (amountText.trim() === '') setAmountText(senToInput(r.amount));
    setCategoryId(r.categoryId);
    setMethodId(r.paymentMethodId);
    setReliefId(r.reliefId);
    setClaimText(r.reliefAmount !== null ? senToInput(r.reliefAmount) : '');
  }

  async function runScan(uri: string, overwrite: boolean) {
    setScanState('scanning');
    const scan = await scanReceipt(uri);
    if (!scan) {
      setScanState('none');
      return;
    }
    // Fill only what is still empty (or untouched), unless the user asked to scan again.
    if (scan.total !== null && (overwrite || amountText.trim() === '')) setAmountText(senToInput(scan.total));
    if (scan.merchant && (overwrite || note.trim() === '')) setNote(scan.merchant);
    if (scan.date && (overwrite || date === today) && scan.date <= today) setDate(scan.date);
    if (scan.sst !== null) setSst(scan.sst);
    setScanned(scan);
    setScanState('found');
  }

  function onReceiptChange(uri: string | null) {
    setReceiptUri(uri);
    setScanned(null);
    setScanState('idle');
    if (uri === null) {
      setSst(null);
      return;
    }
    void runScan(uri, false);
  }

  async function save() {
    if (!valid || amount === null || busy) return;
    setBusy(true);
    setError(null);
    const tag = reliefId
      ? { reliefId, reliefAmount: claim !== null && claim < amount ? claim : null }
      : { reliefId: null, reliefAmount: null };
    try {
      if (existing) {
        await update({ ...existing, amount, categoryId, paymentMethodId: methodId, date, note: note.trim(), receiptUri, sst: sst !== null && sst < amount ? sst : null, ...tag });
      } else {
        const alert = budgetAlert({ expenses, budgets, categoryId, date, amount, startDay: profile.budgetStartDay });
        await add({ amount, categoryId, paymentMethodId: methodId, date, note: note.trim(), receiptUri, sst: sst !== null && sst < amount ? sst : null, ...tag });
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
    const ok = await confirmDelete(
      t('confirm.deleteSpending'),
      t('confirm.deleteSpendingBody', { name: existing.note || categoryName, amount: formatRM(existing.amount) }),
      t('common.delete'),
      t('common.cancel'),
    );
    if (!ok) return;
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
    height: wide ? 48 : 44,
    borderRadius: radius.control,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 12,
    color: c.text,
    fontFamily: fontFamily.medium,
    fontSize: 16,
  } as const;
  const row = { flexDirection: 'row', flexWrap: 'wrap', gap: wide ? 8 : 6 } as const;
  const scrollRow = { flexDirection: 'row', gap: 6, paddingRight: 16 } as const;
  const label = (text: string) => <AppText variant="eyebrow" tone="muted">{text}</AppText>;

  const amountField = (
    <AmountInput
      compact={!wide}
      large={wide}
      label={t('common.amount')}
      value={amountText}
      onChange={(text) => setAmountText(text)}
      autoFocus={!existing}
    />
  );

  const categoryField = (
    <View style={{ gap: wide ? 10 : 4 }}>
      {label(t('common.category'))}
      <View style={row}>
        {categories.map((cat) => (
          <Chip
            compact={!wide}
            key={cat.id}
            label={cat.name}
            icon={categoryLook(cat.name, cat.icon).icon}
            color={categoryLook(cat.name, cat.icon).color}
            selected={cat.id === categoryId}
            onPress={() => setCategoryId(cat.id)}
          />
        ))}
      </View>
    </View>
  );

  const methodChips = methods.map((m) => (
    <Chip compact={!wide} key={m.id} label={m.name} leading={<MethodBadge name={m.name} kind={m.kind} size={wide ? 22 : 20} color={m.id === methodId ? c.onAccent : c.text} />} selected={m.id === methodId} onPress={() => setMethodId(m.id)} />
  ));
  const methodField = (
    <View style={{ gap: wide ? 10 : 4 }}>
      {label(t('method.field'))}
      {wide ? (
        <View style={row}>{methodChips}</View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={scrollRow} keyboardShouldPersistTaps="handled">
          {methodChips}
        </ScrollView>
      )}
    </View>
  );

  const dateField = (
    <View style={{ gap: wide ? 10 : 4 }}>
      {label(t('common.date'))}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Chip compact label={t('expense.today')} selected={date === today} onPress={() => setDate(today)} />
        <Chip compact label={t('expense.yesterday')} selected={date === addDays(today, -1)} onPress={() => setDate(addDays(today, -1))} />
        <DateField compact label={t('common.date')} value={date} onChange={setDate} />
      </View>
    </View>
  );

  const noteInput = (
    <View style={{ gap: wide ? 10 : 4 }}>
      {label(t('common.note'))}
      <TextInput
        accessibilityLabel={t('common.note')}
        value={note}
        onChangeText={(text) => {
          setNote(text);
          setNoteTouched(true);
        }}
        placeholder={t('expense.notePlaceholder')}
        placeholderTextColor={c.muted}
        style={field}
      />
      {suggestions.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={scrollRow}
          keyboardShouldPersistTaps="handled"
          accessibilityLabel={t('note.suggestions')}
        >
          {suggestions.map((sg) => (
            <Chip
              compact
              key={`${sg.kind}-${sg.note}`}
              icon={sg.kind === 'recent' ? 'time-outline' : categoryLook(sg.category, categories.find((cat) => cat.name === sg.category)?.icon).icon}
              color={sg.kind === 'recent' ? undefined : categoryLook(sg.category).color}
              label={sg.note}
              accessibilityLabel={t(sg.kind === 'recent' ? 'recent.chip' : 'note.suggestion', { note: sg.note })}
              onPress={() => pickSuggestion(sg)}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
  const reliefInput = (
    <View style={{ gap: wide ? 10 : 4 }}>
      {label(t('relief.field'))}
      <ReliefPicker compact reliefs={reliefs} value={reliefId} onChange={setReliefId} />
      {suggested ? (
        <View style={{ flexDirection: 'row' }}>
          <Chip
            compact
            icon="sparkles"
            label={t('relief.suggest', { name: suggested.name })}
            accessibilityLabel={t('relief.suggest', { name: suggested.name })}
            onPress={() => setReliefId(suggested.id)}
          />
        </View>
      ) : null}
    </View>
  );

  const claimField = reliefId ? (
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
  ) : null;

  const errorText = error ? (
    <AppText variant="small" tone="negative">
      {error}
    </AppText>
  ) : null;

  const actions = (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <View style={{ flex: 2 }}>
        <Button compact={!wide} title={t('common.save')} onPress={save} disabled={!valid || busy} />
      </View>
      {existing ? (
        <View style={{ flex: 1 }}>
          <Button compact={!wide} title={t('common.delete')} variant="secondary" onPress={del} disabled={busy} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Button compact={!wide} title={t('common.cancel')} variant="secondary" onPress={() => router.back()} />
      </View>
    </View>
  );

  const title = (
    <AppText variant="title" style={wide ? undefined : { fontSize: 28, lineHeight: 34 }}>
      {t(existing ? 'expense.edit' : 'expense.add')}
    </AppText>
  );

  // A saved spending opens read-only; the form only appears after tapping Edit.
  if (editingId !== null && !editMode) {
    if (!existing) return <Screen>{null}</Screen>;
    return (
      <ExpenseDetails
        expense={existing}
        categoryName={categoryName}
        categoryIcon={categories.find((cat) => cat.id === categoryId)?.icon}
        methodName={methods.find((m) => m.id === existing.paymentMethodId)?.name ?? null}
        reliefName={existing.reliefId ? (reliefs.find((r) => r.id === existing.reliefId)?.name ?? existing.reliefId) : null}
        error={error}
        busy={busy}
        onEdit={() => setEditMode(true)}
        onDelete={del}
        onClose={() => router.back()}
      />
    );
  }

  // Field order: amount, note, category, paid with, date, receipt, tax relief. Every size uses cards,
  // a receipt area that grows into the space left, and Save/Cancel pinned at the bottom, so the form
  // fills the screen. Wide screens put category and method side by side; landscape reads down the
  // left column, then the right one (receipt, then tax relief).
  const landscape = wide && width > height;
  const gap = wide ? 16 : 10;
  const pad = wide ? undefined : { padding: 14 };
  const noteCard = <Card style={pad}>{noteInput}</Card>;
  const choices = (
    <View style={{ flexDirection: wide && !landscape ? 'row' : 'column', gap }}>
      <Card style={[pad, wide && !landscape ? { flex: 1 } : null]}>{categoryField}</Card>
      <Card style={[pad, wide && !landscape ? { flex: 1 } : null]}>{methodField}</Card>
    </View>
  );
  const dateCard = <Card style={pad}>{dateField}</Card>;
  const scanStatus = (
    <View style={{ gap: 6 }}>
      {scanState === 'scanning' ? (
        <AppText variant="small" tone="muted">{t('scan.reading')}</AppText>
      ) : scanState === 'found' && scanned ? (
        <AppText variant="small" tone="muted">
          {t('scan.found', {
            amount: scanned.total !== null ? formatRM(scanned.total) : '-',
            sst: scanned.sst !== null ? formatRM(scanned.sst) : '-',
          })}
        </AppText>
      ) : scanState === 'none' ? (
        <AppText variant="small" tone="muted">{t('scan.none')}</AppText>
      ) : sst !== null ? (
        <AppText variant="small" tone="muted">{t('scan.sstSaved', { sst: formatRM(sst) })}</AppText>
      ) : null}
      {scanState !== 'scanning' ? (
        <View style={{ flexDirection: 'row' }}>
          <Chip compact icon="scan-outline" label={t('scan.again')} accessibilityLabel={t('scan.again')} onPress={() => void runScan(receiptUri!, true)} />
        </View>
      ) : null}
    </View>
  );
  const receipt = (
    <Card style={[pad, { flexGrow: 1 }]}>
      <ReceiptField fill compact={!wide} uri={receiptUri} onChange={onReceiptChange} />
      {receiptUri && Platform.OS !== 'web' ? scanStatus : null}
    </Card>
  );
  const reliefCard = (
    <Card style={[pad, { gap: wide ? 16 : 10 }]}>
      {reliefInput}
      {claimField}
    </Card>
  );
  return (
    <Screen compact={!wide} footer={<View style={{ gap: 8 }}>{errorText}{actions}</View>}>
      {title}
      {amountField}
      {landscape ? (
        <View style={{ flexDirection: 'row', gap, flexGrow: 1 }}>
          <View style={{ flex: 1, gap }}>
            {noteCard}
            {choices}
            {dateCard}
          </View>
          <View style={{ flex: 1, gap }}>
            {receipt}
            {reliefCard}
          </View>
        </View>
      ) : (
        <>
          {noteCard}
          {choices}
          {dateCard}
          {receipt}
          {reliefCard}
        </>
      )}
    </Screen>
  );
}
