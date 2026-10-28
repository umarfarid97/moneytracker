import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { LATEST_TAX_YEAR } from '@/data/tax';
import { dayLabel, shortDate, monthKey, monthLabel, shiftMonth } from '@/domain/dates';
import { billEstimate, lastPaidFor } from '@/domain/bills';
import { loanBalance, nextPayment } from '@/domain/loanTracker';
import { formatRM } from '@/domain/money';
import { brandForBill, brandForNote } from '@/domain/brandLookup';
import { pendingBills, type PendingBill } from '@/domain/pendingBills';
import {
  activeFilterCount, EMPTY_FILTERS, filterExpenses, totalsByMethod, type SpendingFilters,
} from '@/domain/spendingFilter';
import { groupByDay, monthSpent } from '@/domain/summary';
import type { Category, Commitment, Expense, PaymentMethod } from '@/domain/types';
import { MarkPaidSheet } from '@/features/commitments/MarkPaidSheet';
import { useCategories } from '@/hooks/useCategories';
import { useData } from '@/hooks/DataProvider';
import { useCommitments } from '@/hooks/useCommitments';
import { useExpenses } from '@/hooks/useExpenses';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { useShowPending } from '@/hooks/useShowPending';
import { useToday } from '@/hooks/useToday';
import { methodLabel } from '@/i18n/content';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { MethodBadge } from '@/ui/MethodBadge';
import { confirmDelete } from '@/ui/confirm';
import { EmptyState } from '@/ui/EmptyState';
import { HeroCard, onHero } from '@/ui/HeroCard';
import { BrandBadge } from '@/ui/BrandBadge';
import { IconBadge } from '@/ui/IconBadge';
import { Screen } from '@/ui/Screen';
import { Sheet } from '@/ui/Sheet';
import { SwipeRow } from '@/ui/SwipeRow';
import { categoryLook, categoryTint, controlHeight, elevation, fontFamily, radius, space, statusStyle } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

type Item =
  | { type: 'header'; key: string; label: string; total: number }
  | { type: 'row'; key: string; expense: Expense }
  | { type: 'pending'; key: string; bill: PendingBill };

const RELIEFS = LATEST_TAX_YEAR.reliefs;

/** A bill that is due but not paid yet: muted, with a quick Mark paid. It is not spending until it is paid. */
const PendingRow = memo(function PendingRow({ bill, amount, onPay }: { bill: PendingBill; amount: number; onPay: (b: PendingBill) => void }) {
  const { c } = useTheme();
  const { commitment: item } = bill;
  const brand = brandForBill(item.name, item.kind, item.loanType);
  return (
    <View
      testID="pending-row"
      style={{
        backgroundColor: c.surface, borderRadius: radius.control + 2, paddingHorizontal: 14, paddingVertical: 12, minHeight: 68,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, opacity: 0.75,
        borderWidth: 1, borderStyle: 'dashed', borderColor: c.border,
      }}
    >
      {brand ? <BrandBadge {...brand} size={42} testID={`brand-${brand.id}`} /> : <IconBadge icon="time-outline" color={c.muted} size={42} />}
      <View style={{ flex: 1, gap: 4 }}>
        <AppText testID="pending-name" variant="bodyStrong" numberOfLines={1}>{item.name}</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <View style={{ backgroundColor: c.accentSoft, borderRadius: radius.xs, paddingHorizontal: 8, paddingVertical: 2 }}>
            <AppText variant="small" color={c.accentInk}>{t('spending.pendingBadge')}</AppText>
          </View>
          <AppText variant="small" tone={bill.overdue ? 'negative' : 'muted'}>
            {t(bill.overdue ? 'spending.pendingOverdue' : 'spending.pendingDue', { date: shortDate(bill.dueDate) })}
          </AppText>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <AppText variant="bodyStrong" tone="muted">{`${item.variable ? '~' : ''}${formatRM(amount)}`}</AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('commitments.markPaid')} ${item.name}`}
          hitSlop={8}
          onPress={() => onPay(bill)}
          style={{ backgroundColor: c.accentSoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 4 }}
        >
          <AppText variant="smallStrong" color={c.accentInk}>{t('commitments.markPaid')}</AppText>
        </Pressable>
      </View>
    </View>
  );
});

const Row = memo(function Row({
  expense, category, method, onOpen, onDelete,
}: {
  expense: Expense;
  category: Category | undefined;
  method: PaymentMethod | null;
  onOpen: (e: Expense) => void;
  onDelete: (e: Expense) => void;
}) {
  const { c, scheme } = useTheme();
  const name = category?.name ?? '';
  const tint = categoryTint(name, scheme);
  const look = categoryLook(name, category?.icon);
  const brand = useMemo(() => brandForNote(expense.note), [expense.note]);
  const accent = { bg: c.accentSoft, ink: c.accentInk };
  const warn = statusStyle('tight', scheme);
  const tagged = expense.reliefId !== null;
  const needsReceipt = tagged && RELIEFS.find((r) => r.id === expense.reliefId)?.requiresReceipt === true && !expense.receiptUri;
  const pill = (colors: { bg: string; ink: string }, text: string) => (
    <View style={{ backgroundColor: colors.bg, borderRadius: radius.xs, paddingHorizontal: 8, paddingVertical: 2 }}>
      <AppText variant="small" color={colors.ink}>
        {text}
      </AppText>
    </View>
  );
  return (
    <SwipeRow onDelete={() => onDelete(expense)}>
      <Pressable
        accessibilityRole="button"
        onPress={() => onOpen(expense)}
        style={{
          // The rounded corners come from SwipeRow, so the hidden Delete action never shows at the edges.
          backgroundColor: c.surface,
          paddingHorizontal: 14,
          paddingVertical: 12,
          minHeight: 68,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        {brand ? <BrandBadge {...brand} size={42} testID={`brand-${brand.id}`} /> : <IconBadge icon={look.icon} color={look.color} size={42} />}
        <View style={{ flex: 1, gap: 6 }}>
          <AppText testID="spending-note" variant="bodyStrong" numberOfLines={1}>
            {expense.note || name}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            {expense.note ? pill(tint, name) : null}
            {method ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <MethodBadge name={method.name} kind={method.kind} size={16} color={c.muted} />
                <AppText variant="small" tone="muted">
                  {method.name}
                </AppText>
              </View>
            ) : null}
            {tagged ? pill(accent, t('spending.badge.relief')) : null}
            {needsReceipt ? pill(warn, t('tax.missingReceipt')) : null}
          </View>
        </View>
        {/* Money out, in red-orange like the reference design. */}
        <AppText variant="bodyStrong" tone="negative">{formatRM(expense.amount)}</AppText>
      </Pressable>
    </SwipeRow>
  );
});

export default function Spending() {
  const { c, scheme } = useTheme();
  const today = useToday();
  const thisMonth = monthKey(today);
  const [month, setMonth] = useState(thisMonth);
  const [filters, setFilters] = useState<SpendingFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // A Home tile opens this tab on that category's spending for this month.
  // `at` changes on every tap, so tapping the same tile again re-applies it.
  const params = useLocalSearchParams<{ categoryId?: string; at?: string }>();
  useEffect(() => {
    const id = Number(params.categoryId);
    if (!params.categoryId || !Number.isFinite(id)) return;
    setFilters({ ...EMPTY_FILTERS, categoryId: id });
    setMonth(thisMonth);
  }, [params.categoryId, params.at]);
  const { data: expenses, remove } = useExpenses();
  const { payBill, profile } = useData();
  const { data: commitments } = useCommitments();
  const [showPending, setShowPending] = useShowPending();
  const [pay, setPay] = useState<{ bill: PendingBill | null; nonce: number }>({ bill: null, nonce: 0 });
  const { data: categories } = useCategories();
  const { data: methods } = usePaymentMethods();

  const filterCount = activeFilterCount(filters);
  const inMonth = useMemo(() => expenses.filter((e) => monthKey(e.date) === month), [expenses, month]);
  const visible = useMemo(
    () => filterExpenses(inMonth, filters, { categories, methods, reliefs: RELIEFS }),
    [inMonth, filters, categories, methods],
  );
  const pending = useMemo(() => {
    // Only for the current month, and only when no filter narrows the list beyond search text.
    if (!showPending || month !== thisMonth || filterCount > 0) return [];
    const text = filters.text.trim().toLowerCase();
    return pendingBills({ commitments, expenses, today, startDay: profile.budgetStartDay })
      .filter((p) => text === '' || p.commitment.name.toLowerCase().includes(text));
  }, [showPending, month, thisMonth, filterCount, filters.text, commitments, expenses, today, profile.budgetStartDay]);
  const items = useMemo<Item[]>(
    () => [
      ...(pending.length > 0
        ? [
            { type: 'header' as const, key: 'h-pending', label: t('spending.pending'), total: -1 },
            ...pending.map((bill) => ({ type: 'pending' as const, key: `p-${bill.commitment.id}`, bill })),
          ]
        : []),
      ...groupByDay(visible).flatMap((g) => [
        { type: 'header' as const, key: `h-${g.date}`, label: dayLabel(g.date, today), total: g.total },
        ...g.items.map((expense) => ({ type: 'row' as const, key: `e-${expense.id}`, expense })),
      ]),
    ],
    [visible, today, pending],
  );
  const categoryById = useMemo(() => new Map(categories.map((cat) => [cat.id, cat])), [categories]);
  const filterCategory = filters.categoryId !== null ? categoryById.get(filters.categoryId) : undefined;
  const methodById = useMemo(() => new Map(methods.map((m) => [m.id, m])), [methods]);
  const methodTotals = useMemo(() => totalsByMethod(inMonth, methods, t('methods.noMethod')), [inMonth, methods]);
  const narrowed = filterCount > 0 || filters.text.trim() !== '';

  const open = useCallback((e: Expense) => {
    if (e.id > 0) router.push({ pathname: '/add-expense', params: { id: String(e.id) } });
  }, []);
  const del = useCallback(async (e: Expense) => {
    const name = e.note || categoryById.get(e.categoryId)?.name || '';
    const ok = await confirmDelete(
      t('confirm.deleteSpending'),
      t('confirm.deleteSpendingBody', { name, amount: formatRM(e.amount) }),
      t('common.delete'),
      t('common.cancel'),
    );
    if (ok) remove(e.id).catch(() => {});
  }, [remove, categoryById]);
  const set = (patch: Partial<SpendingFilters>) => setFilters((f) => ({ ...f, ...patch }));

  const billEstimateFor = useCallback((c: Commitment) => billEstimate(c, expenses), [expenses]);

  // Stable, so scrolling and typing in search don't re-render rows that haven't changed.
  const renderItem = useCallback(
    ({ item }: { item: Item }) =>
      item.type === 'header' ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingHorizontal: 4 }}>
          <AppText variant="eyebrow" tone="muted">
            {item.label}
          </AppText>
          {item.total >= 0 ? (
            <AppText variant="smallStrong" tone="muted">
              {formatRM(item.total)}
            </AppText>
          ) : null}
        </View>
      ) : item.type === 'pending' ? (
        <PendingRow
          bill={item.bill}
          amount={billEstimateFor(item.bill.commitment)}
          onPay={(b) => setPay((p) => ({ bill: b, nonce: p.nonce + 1 }))}
        />
      ) : (
        <Row
          expense={item.expense}
          category={categoryById.get(item.expense.categoryId)}
          method={item.expense.paymentMethodId === null ? null : methodById.get(item.expense.paymentMethodId) ?? null}
          onOpen={open}
          onDelete={del}
        />
      ),
    [categoryById, methodById, open, del, billEstimateFor],
  );

  return (
    <Screen scroll={false} fab>
      <FlatList
        data={items}
        keyExtractor={(item) => item.key}
        // Long months stay smooth: draw a screenful first, then render ahead in small batches so fast
        // scrolling doesn't outrun the list. Rows aren't detached when off screen: on Android that left
        // blank, cut-off rows at the bottom while scrolling.
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={30}
        windowSize={15}
        contentContainerStyle={{ gap: 8, paddingHorizontal: space.pad, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 8 }}>
            <HeroCard hero="ocean" style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('spending.prevMonth')}
                  hitSlop={12}
                  onPress={() => setMonth((m) => shiftMonth(m, -1))}
                >
                  <Ionicons name="chevron-back" size={24} color={onHero.ink} />
                </Pressable>
                <AppText variant="section" color={onHero.ink}>{monthLabel(month)}</AppText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('spending.nextMonth')}
                  accessibilityState={{ disabled: month >= thisMonth }}
                  disabled={month >= thisMonth}
                  hitSlop={12}
                  onPress={() => setMonth((m) => shiftMonth(m, 1))}
                  style={{ opacity: month >= thisMonth ? 0.3 : 1 }}
                >
                  <Ionicons name="chevron-forward" size={24} color={onHero.ink} />
                </Pressable>
              </View>
              <View style={{ alignSelf: 'center', backgroundColor: onHero.chip, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6 }}>
                <AppText variant="bodyStrong" color={onHero.ink} style={{ textAlign: 'center' }}>
                  {t('spending.monthTotal', { amount: formatRM(monthSpent(expenses, month)) })}
                </AppText>
              </View>
            </HeroCard>

            {methodTotals.length > 0 ? (
              <Card style={{ gap: 8 }}>
                <AppText variant="eyebrow" tone="muted">
                  {t('spending.byMethod')}
                </AppText>
                {methodTotals.map((m) => (
                  <View key={m.methodId ?? 'none'} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      {m.kind ? <MethodBadge name={m.name} kind={m.kind} size={24} /> : null}
                      <AppText variant="body">{m.name}</AppText>
                    </View>
                    <AppText testID={`method-total-${m.methodId ?? 'none'}`} variant="bodyStrong">
                      {formatRM(m.total)}
                    </AppText>
                  </View>
                ))}
              </Card>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <View
                style={[
                  { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, height: controlHeight, borderRadius: radius.control, backgroundColor: c.surface, paddingLeft: 14 },
                  elevation(scheme),
                ]}
              >
              <Ionicons name="search" size={18} color={c.muted} />
              <TextInput
                accessibilityLabel={t('spending.search')}
                value={filters.text}
                onChangeText={(text) => set({ text })}
                placeholder={t('spending.search')}
                placeholderTextColor={c.muted}
                autoCapitalize="none"
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: controlHeight,
                  paddingRight: 14,
                  color: c.text,
                  fontFamily: fontFamily.medium,
                  fontSize: 16,
                  outlineWidth: 0,
                }}
              />
              </View>
              <View style={{ flexShrink: 0 }}>
                <Button
                  title={filterCount > 0 ? t('spending.filtersCount', { count: filterCount }) : t('spending.filters')}
                  variant="secondary"
                  onPress={() => setFiltersOpen(true)}
                />
              </View>
            </View>
            {filterCategory ? (
              <View style={{ flexDirection: 'row' }}>
                <Chip
                  compact
                  selected
                  icon="close-circle"
                  color={categoryLook(filterCategory.name, filterCategory.icon).color}
                  label={filterCategory.name}
                  accessibilityLabel={t('spending.allCategories', { name: filterCategory.name })}
                  onPress={() => set({ categoryId: null })}
                />
              </View>
            ) : null}
            {narrowed && inMonth.length > 0 ? (
              <AppText variant="small" tone="muted">
                {t('spending.showing', { count: visible.length, total: inMonth.length })}
              </AppText>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon={narrowed && inMonth.length > 0 ? 'search' : 'receipt-outline'}
            text={narrowed && inMonth.length > 0 ? t('spending.noMatch') : t('expense.none')}
          />
        }
        renderItem={renderItem}
      />

      <MarkPaidSheet
        key={`pay-${pay.nonce}`}
        visible={pay.bill !== null}
        bill={pay.bill?.commitment ?? null}
        lastPaid={pay.bill ? lastPaidFor(pay.bill.commitment.id, expenses) : null}
        suggested={pay.bill ? nextPayment(pay.bill.commitment, loanBalance(pay.bill.commitment, expenses)) : null}
        today={today}
        startDay={profile.budgetStartDay}
        onClose={() => setPay((p) => ({ ...p, bill: null }))}
        onConfirm={async (amount, date, paymentMethodId) => {
          if (pay.bill) await payBill(pay.bill.commitment, pay.bill.dueDate, { amount, date, paymentMethodId });
        }}
      />

      <Sheet visible={filtersOpen} title={t('spending.filters')} onClose={() => setFiltersOpen(false)}>
        <View style={{ gap: 12 }}>
          <AppText variant="smallStrong">{t('common.category')}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip
              label={t('spending.all')}
              accessibilityLabel={`Filter category ${t('spending.all')}`}
              selected={filters.categoryId === null}
              onPress={() => set({ categoryId: null })}
            />
            {categories.map((cat) => (
              <Chip
                key={cat.id}
                label={cat.name}
                icon={categoryLook(cat.name, cat.icon).icon}
                color={categoryLook(cat.name, cat.icon).color}
                accessibilityLabel={`Filter category ${cat.name}`}
                selected={filters.categoryId === cat.id}
                onPress={() => set({ categoryId: cat.id })}
              />
            ))}
          </View>
          <AppText variant="smallStrong">{t('method.field')}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip
              label={t('spending.all')}
              accessibilityLabel={`Filter method ${t('spending.all')}`}
              selected={filters.paymentMethodId === null}
              onPress={() => set({ paymentMethodId: null })}
            />
            {methods.map((m) => (
              <Chip
                key={m.id}
                label={methodLabel(m.name)}
                accessibilityLabel={`Filter method ${m.name}`}
                leading={<MethodBadge name={m.name} kind={m.kind} size={20} color={filters.paymentMethodId === m.id ? c.onAccent : c.text} />}
                selected={filters.paymentMethodId === m.id}
                onPress={() => set({ paymentMethodId: m.id })}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label={t('spending.taggedOnly')} selected={filters.taggedOnly} onPress={() => set({ taggedOnly: !filters.taggedOnly })} />
            <Chip label={t('spending.showPending')} selected={showPending} onPress={() => setShowPending(!showPending)} />
            <Chip label={t('spending.missingReceipt')} selected={filters.missingReceipt} onPress={() => set({ missingReceipt: !filters.missingReceipt })} />
          </View>
          <Button title={t('spending.clear')} variant="secondary" onPress={() => setFilters((f) => ({ ...EMPTY_FILTERS, text: f.text }))} />
        </View>
      </Sheet>
    </Screen>
  );
}
