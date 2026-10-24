import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { LATEST_TAX_YEAR } from '@/data/tax';
import { dayLabel, monthKey, monthLabel, shiftMonth } from '@/domain/dates';
import { formatRM } from '@/domain/money';
import {
  activeFilterCount, EMPTY_FILTERS, filterExpenses, totalsByMethod, type SpendingFilters,
} from '@/domain/spendingFilter';
import { groupByDay, monthSpent } from '@/domain/summary';
import type { Category, Expense } from '@/domain/types';
import { useCategories } from '@/hooks/useCategories';
import { useExpenses } from '@/hooks/useExpenses';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { useToday } from '@/hooks/useToday';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { Screen } from '@/ui/Screen';
import { Sheet } from '@/ui/Sheet';
import { SwipeRow } from '@/ui/SwipeRow';
import { categoryTint, controlHeight, fontFamily, radius, statusStyle } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

type Item =
  | { type: 'header'; key: string; label: string; total: number }
  | { type: 'row'; key: string; expense: Expense };

const RELIEFS = LATEST_TAX_YEAR.reliefs;

const Row = memo(function Row({
  expense, category, methodName, onOpen, onDelete,
}: {
  expense: Expense;
  category: Category | undefined;
  methodName: string | null;
  onOpen: (e: Expense) => void;
  onDelete: (e: Expense) => void;
}) {
  const { c, scheme } = useTheme();
  const name = category?.name ?? '';
  const tint = categoryTint(name, scheme);
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
          paddingHorizontal: 16,
          paddingVertical: 12,
          minHeight: 64,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <View style={{ flex: 1, gap: 6 }}>
          <AppText testID="spending-note" variant="bodyStrong" numberOfLines={1}>
            {expense.note || name}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            {expense.note ? pill(tint, name) : null}
            {methodName ? (
              <AppText variant="small" tone="muted">
                {methodName}
              </AppText>
            ) : null}
            {tagged ? pill(accent, t('spending.badge.relief')) : null}
            {needsReceipt ? pill(warn, t('tax.missingReceipt')) : null}
          </View>
        </View>
        <AppText variant="bodyStrong">{formatRM(expense.amount)}</AppText>
      </Pressable>
    </SwipeRow>
  );
});

export default function Spending() {
  const { c } = useTheme();
  const today = useToday();
  const thisMonth = monthKey(today);
  const [month, setMonth] = useState(thisMonth);
  const [filters, setFilters] = useState<SpendingFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { data: expenses, remove } = useExpenses();
  const { data: categories } = useCategories();
  const { data: methods } = usePaymentMethods();

  const inMonth = useMemo(() => expenses.filter((e) => monthKey(e.date) === month), [expenses, month]);
  const visible = useMemo(
    () => filterExpenses(inMonth, filters, { categories, methods, reliefs: RELIEFS }),
    [inMonth, filters, categories, methods],
  );
  const items = useMemo<Item[]>(
    () =>
      groupByDay(visible).flatMap((g) => [
        { type: 'header' as const, key: `h-${g.date}`, label: dayLabel(g.date, today), total: g.total },
        ...g.items.map((expense) => ({ type: 'row' as const, key: `e-${expense.id}`, expense })),
      ]),
    [visible, today],
  );
  const categoryById = useMemo(() => new Map(categories.map((cat) => [cat.id, cat])), [categories]);
  const methodById = useMemo(() => new Map(methods.map((m) => [m.id, m.name])), [methods]);
  const methodTotals = useMemo(() => totalsByMethod(inMonth, methods, t('methods.noMethod')), [inMonth, methods]);
  const filterCount = activeFilterCount(filters);
  const narrowed = filterCount > 0 || filters.text.trim() !== '';

  const open = useCallback((e: Expense) => {
    if (e.id > 0) router.push({ pathname: '/add-expense', params: { id: String(e.id) } });
  }, []);
  const del = useCallback((e: Expense) => {
    remove(e.id).catch(() => {});
  }, [remove]);
  const set = (patch: Partial<SpendingFilters>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <Screen scroll={false} fab>
      <FlatList
        data={items}
        keyExtractor={(item) => item.key}
        contentContainerStyle={{ gap: 8, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 8 }}>
            <Card style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('spending.prevMonth')}
                  hitSlop={12}
                  onPress={() => setMonth((m) => shiftMonth(m, -1))}
                >
                  <Ionicons name="chevron-back" size={24} color={c.text} />
                </Pressable>
                <AppText variant="section">{monthLabel(month)}</AppText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('spending.nextMonth')}
                  accessibilityState={{ disabled: month >= thisMonth }}
                  disabled={month >= thisMonth}
                  hitSlop={12}
                  onPress={() => setMonth((m) => shiftMonth(m, 1))}
                  style={{ opacity: month >= thisMonth ? 0.3 : 1 }}
                >
                  <Ionicons name="chevron-forward" size={24} color={c.text} />
                </Pressable>
              </View>
              <AppText variant="bodyStrong" tone="muted" style={{ textAlign: 'center' }}>
                {t('spending.monthTotal', { amount: formatRM(monthSpent(expenses, month)) })}
              </AppText>
            </Card>

            {methodTotals.length > 0 ? (
              <Card style={{ gap: 8 }}>
                <AppText variant="smallStrong" tone="muted">
                  {t('spending.byMethod')}
                </AppText>
                {methodTotals.map((m) => (
                  <View key={m.methodId ?? 'none'} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <AppText variant="body">{m.name}</AppText>
                    <AppText testID={`method-total-${m.methodId ?? 'none'}`} variant="bodyStrong">
                      {formatRM(m.total)}
                    </AppText>
                  </View>
                ))}
              </Card>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
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
                  borderRadius: radius.control,
                  backgroundColor: c.track,
                  paddingHorizontal: 14,
                  color: c.text,
                  fontFamily: fontFamily.medium,
                  fontSize: 16,
                }}
              />
              <View style={{ flexShrink: 0 }}>
                <Button
                  title={filterCount > 0 ? t('spending.filtersCount', { count: filterCount }) : t('spending.filters')}
                  variant="secondary"
                  onPress={() => setFiltersOpen(true)}
                />
              </View>
            </View>
            {narrowed && inMonth.length > 0 ? (
              <AppText variant="small" tone="muted">
                {t('spending.showing', { count: visible.length, total: inMonth.length })}
              </AppText>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <AppText variant="body" tone="muted" style={{ textAlign: 'center', marginTop: 24 }}>
            {narrowed && inMonth.length > 0 ? t('spending.noMatch') : t('expense.none')}
          </AppText>
        }
        renderItem={({ item }) =>
          item.type === 'header' ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <AppText variant="smallStrong" tone="muted">
                {item.label}
              </AppText>
              <AppText variant="smallStrong" tone="muted">
                {formatRM(item.total)}
              </AppText>
            </View>
          ) : (
            <Row
              expense={item.expense}
              category={categoryById.get(item.expense.categoryId)}
              methodName={item.expense.paymentMethodId === null ? null : methodById.get(item.expense.paymentMethodId) ?? null}
              onOpen={open}
              onDelete={del}
            />
          )
        }
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
                label={m.name}
                accessibilityLabel={`Filter method ${m.name}`}
                selected={filters.paymentMethodId === m.id}
                onPress={() => set({ paymentMethodId: m.id })}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label={t('spending.taggedOnly')} selected={filters.taggedOnly} onPress={() => set({ taggedOnly: !filters.taggedOnly })} />
            <Chip label={t('spending.missingReceipt')} selected={filters.missingReceipt} onPress={() => set({ missingReceipt: !filters.missingReceipt })} />
          </View>
          <Button title={t('spending.clear')} variant="secondary" onPress={() => setFilters((f) => ({ ...EMPTY_FILTERS, text: f.text }))} />
        </View>
      </Sheet>
    </Screen>
  );
}
