import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { daysLeftInPeriod, periodKey, periodLabel } from '@/domain/budgetPeriod';
import { formatRM } from '@/domain/money';
import { buildHome, type BudgetTile } from '@/domain/summary';
import { useExpenses } from '@/hooks/useExpenses';
import { useBudgets } from '@/hooks/useBudgets';
import { useCategories } from '@/hooks/useCategories';
import { useProfile } from '@/hooks/useProfile';
import { useToday } from '@/hooks/useToday';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { PaydayPicker } from '@/ui/PaydayPicker';
import { ProgressBar } from '@/ui/ProgressBar';
import { Screen } from '@/ui/Screen';
import { useTheme } from '@/ui/useTheme';

export default function Budget() {
  const { c } = useTheme();
  const today = useToday();
  const { data: profile, save: saveProfile } = useProfile();
  const startDay = profile.budgetStartDay;
  const month = periodKey(today, startDay);
  const { data: categories } = useCategories();
  const { data: budgets } = useBudgets(month);
  const { data: expenses } = useExpenses();
  const { tiles } = useMemo(
    () => buildHome({ categories, expenses, budgets, today, startDay }),
    [categories, expenses, budgets, today, startDay],
  );
  const budgeted = tiles.filter((x): x is BudgetTile => x.limit !== null);
  const warnings = budgeted.filter((x) => x.status !== 'on-track');

  const [error, setError] = useState<string | null>(null);

  /** The budget period changes with the start day, so budgets already typed in are left as they were. */
  async function changeStartDay(day: number) {
    if (day === startDay) return;
    setError(null);
    try {
      await saveProfile({ ...profile, budgetStartDay: day });
    } catch {
      setError(t('common.saveFailed'));
    }
  }

  const total = budgets.reduce((sum, b) => sum + b.limit, 0);
  const limitOf = (id: number) => budgets.find((b) => b.categoryId === id)?.limit ?? null;

  return (
    <Screen>
      <BackButton />
      <View style={{ gap: 4 }}>
        <AppText variant="title">{t('budget.title')}</AppText>
        <AppText variant="bodyStrong" tone="muted">
          {periodLabel(month, startDay)}
        </AppText>
        {startDay !== 1 ? (
          <AppText variant="small" tone="muted">
            {(() => {
              const left = daysLeftInPeriod(today, startDay);
              return left === 1 ? t('budget.daysLeft1') : t('budget.daysLeft', { count: left });
            })()}
          </AppText>
        ) : null}
      </View>
      {warnings.length > 0 ? (
        <Card style={{ gap: 6, borderLeftWidth: 4, borderLeftColor: c.negative }}>
          <AppText variant="bodyStrong">{t('budget.warning')}</AppText>
          {warnings.map((w) => (
            <AppText key={w.categoryId} variant="small">
              {w.status === 'over'
                ? t('budget.warning.over', { category: w.name })
                : t('budget.warning.near', { category: w.name, percent: Math.round((w.spent * 100) / w.limit) })}
            </AppText>
          ))}
        </Card>
      ) : null}
      <Card style={{ gap: 12 }}>
        <AppText variant="bodyStrong">{t('budget.progress')}</AppText>
        {budgeted.length === 0 ? <AppText variant="small" tone="muted">{t('budget.progress.empty')}</AppText> : null}
        {budgeted.map((x) => (
          <View key={x.categoryId} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <AppText variant="bodyStrong" style={{ flex: 1 }}>{x.name}</AppText>
              <AppText variant="small" tone="muted">{formatRM(x.spent)} / {formatRM(x.limit)}</AppText>
            </View>
            <ProgressBar fraction={x.limit > 0 ? x.spent / x.limit : 1} color={x.status === 'over' ? c.negative : undefined} />
          </View>
        ))}
      </Card>
      <Card style={{ gap: 12 }}>
        <View style={{ gap: 4 }}>
          <AppText variant="bodyStrong">{t('budget.startDay')}</AppText>
          <AppText variant="small" tone="muted">{t('budget.startDayHint')}</AppText>
        </View>
        <PaydayPicker value={startDay} onChange={changeStartDay} />
      </Card>
      <Card style={{ gap: 4 }}>
        <AppText variant="small" tone="muted">
          {t('budget.month')}
        </AppText>
        <AppText testID="budget-total" variant="kpi">
          {formatRM(total)}
        </AppText>
      </Card>
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <AppText variant="bodyStrong" style={{ flex: 1 }}>{t('budget.amounts')}</AppText>
          <Chip compact icon="create-outline" label={t('budget.edit')} onPress={() => router.push('/budget-edit')} />
        </View>
        {categories.map((category) => {
          const limit = limitOf(category.id);
          return (
            <View key={category.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <AppText variant="body" style={{ flex: 1 }}>{category.name}</AppText>
              <AppText variant="bodyStrong" tone={limit === null ? 'muted' : undefined} testID={`budget-amount-${category.id}`}>
                {limit === null ? t('budget.notSet') : formatRM(limit)}
              </AppText>
            </View>
          );
        })}
      </Card>
      {error ? (
        <AppText variant="small" tone="negative">
          {error}
        </AppText>
      ) : null}
      <Button title={t('budget.seeReport')} variant="secondary" onPress={() => router.push('/reports')} />
    </Screen>
  );
}
