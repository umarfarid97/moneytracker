import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { dayLabel, monthKey, monthLabel, shiftMonth } from '@/domain/dates';
import { formatRM } from '@/domain/money';
import { groupByDay, monthSpent } from '@/domain/summary';
import type { Category, Expense } from '@/domain/types';
import { useCategories } from '@/hooks/useCategories';
import { useExpenses } from '@/hooks/useExpenses';
import { useToday } from '@/hooks/useToday';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SwipeRow } from '@/ui/SwipeRow';
import { categoryTint, radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

type Item =
  | { type: 'header'; key: string; label: string; total: number }
  | { type: 'row'; key: string; expense: Expense };

const Row = memo(function Row({
  expense, category, onOpen, onDelete,
}: {
  expense: Expense;
  category: Category | undefined;
  onOpen: (e: Expense) => void;
  onDelete: (e: Expense) => void;
}) {
  const { c, scheme } = useTheme();
  const name = category?.name ?? '';
  const tint = categoryTint(name, scheme);
  return (
    <SwipeRow onDelete={() => onDelete(expense)}>
      <Pressable
        accessibilityRole="button"
        onPress={() => onOpen(expense)}
        style={{
          backgroundColor: c.surface,
          borderRadius: radius.control,
          paddingHorizontal: 16,
          minHeight: 64,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {expense.note || name}
          </AppText>
          {expense.note ? (
            <View style={{ alignSelf: 'flex-start', backgroundColor: tint.bg, borderRadius: radius.xs, paddingHorizontal: 8, paddingVertical: 2 }}>
              <AppText variant="small" color={tint.ink}>
                {name}
              </AppText>
            </View>
          ) : null}
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
  const { data: expenses, remove } = useExpenses();
  const { data: categories } = useCategories();

  const inMonth = useMemo(() => expenses.filter((e) => monthKey(e.date) === month), [expenses, month]);
  const items = useMemo<Item[]>(
    () =>
      groupByDay(inMonth).flatMap((g) => [
        { type: 'header' as const, key: `h-${g.date}`, label: dayLabel(g.date, today), total: g.total },
        ...g.items.map((expense) => ({ type: 'row' as const, key: `e-${expense.id}`, expense })),
      ]),
    [inMonth, today],
  );
  const categoryById = useMemo(() => new Map(categories.map((cat) => [cat.id, cat])), [categories]);

  const open = useCallback((e: Expense) => {
    if (e.id > 0) router.push({ pathname: '/add-expense', params: { id: String(e.id) } });
  }, []);
  const del = useCallback((e: Expense) => {
    remove(e.id).catch(() => {});
  }, [remove]);

  return (
    <Screen scroll={false} fab>
      <FlatList
        data={items}
        keyExtractor={(item) => item.key}
        contentContainerStyle={{ gap: 8, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Card style={{ gap: 4, marginBottom: 8 }}>
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
        }
        ListEmptyComponent={
          <AppText variant="body" tone="muted" style={{ textAlign: 'center', marginTop: 24 }}>
            {t('expense.none')}
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
              onOpen={open}
              onDelete={del}
            />
          )
        }
      />
    </Screen>
  );
}
