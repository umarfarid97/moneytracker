import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { periodKey, periodLabel } from '@/domain/budgetPeriod';
import { dayMonth, monthLabel, shiftMonth } from '@/domain/dates';
import { formatRM } from '@/domain/money';
import { categoryBreakdown, monthlyTrend, reportCsv, reportHtml, yearInReview } from '@/domain/reports';
import { useBudgets } from '@/hooks/useBudgets';
import { useCategories } from '@/hooks/useCategories';
import { useExpenses } from '@/hooks/useExpenses';
import { useProfile } from '@/hooks/useProfile';
import { useToday } from '@/hooks/useToday';
import { shareTextFile, sharePdf } from '@/exportFile';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { BarChart } from '@/ui/BarChart';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { HeroCard } from '@/ui/HeroCard';
import { ProgressBar } from '@/ui/ProgressBar';
import { Screen } from '@/ui/Screen';
import { useTheme } from '@/ui/useTheme';

export default function Reports() {
  const { c } = useTheme();
  const today = useToday();
  const { data: profile } = useProfile();
  const startDay = profile.budgetStartDay;
  const current = periodKey(today, startDay);
  const [key, setKey] = useState(current);
  const { data: expenses } = useExpenses();
  const { data: categories } = useCategories();
  const { data: budgets } = useBudgets(key);
  const [error, setError] = useState<string | null>(null);
  const year = Number(key.slice(0, 4));

  const trend = useMemo(() => monthlyTrend(expenses, key, 6, startDay), [expenses, key, startDay]);
  const split = useMemo(() => categoryBreakdown(expenses, categories, key, startDay), [expenses, categories, key, startDay]);
  const review = useMemo(() => yearInReview(expenses, categories, year), [expenses, categories, year]);
  const periodTotal = trend[trend.length - 1].total;
  const limits = new Map(budgets.map((b) => [b.categoryId, b.limit]));

  async function exportAs(kind: 'pdf' | 'csv') {
    setError(null);
    const input = { expenses, categories, key, startDay, year };
    try {
      if (kind === 'pdf') await sharePdf(reportHtml(input, t('reports.fileTitle')), t('reports.pdf'));
      else await shareTextFile(`duit-report-${key}.csv`, reportCsv(input), 'text/csv', t('reports.csv'));
    } catch {
      setError(t('reports.exportFailed'));
    }
  }

  return (
    <Screen>
      <BackButton />
      <AppText variant="title">{t('reports.title')}</AppText>
      <HeroCard style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('reports.prev')} hitSlop={12} onPress={() => setKey(shiftMonth(key, -1))}>
            <Ionicons name="chevron-back" size={22} color={c.heroGradient ? c.heroInk : c.accent} />
          </Pressable>
          <AppText variant="eyebrow" color={c.heroSoft}>{periodLabel(key, startDay)}</AppText>
          <Pressable
            accessibilityRole="button" accessibilityLabel={t('reports.next')} hitSlop={12}
            disabled={key >= current} onPress={() => setKey(shiftMonth(key, 1))}
            style={{ opacity: key >= current ? 0.3 : 1 }}
          >
            <Ionicons name="chevron-forward" size={22} color={c.heroGradient ? c.heroInk : c.accent} />
          </Pressable>
        </View>
        <AppText testID="report-total" variant="kpi" color={c.heroInk}>{formatRM(periodTotal)}</AppText>
      </HeroCard>

      <Card style={{ gap: 12 }}>
        <AppText variant="bodyStrong">{t('reports.trend')}</AppText>
        <BarChart
          highlight={key}
          bars={trend.map((p) => ({ key: p.key, label: monthLabel(p.key).slice(0, 3), value: p.total }))}
        />
      </Card>

      <Card style={{ gap: 14 }}>
        <AppText variant="bodyStrong">{t('reports.byCategory')}</AppText>
        {split.length === 0 ? <AppText tone="muted">{t('reports.empty')}</AppText> : null}
        {split.map((row) => {
          const limit = limits.get(row.categoryId);
          const over = limit !== undefined && row.total > limit;
          return (
            <View key={row.categoryId} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <AppText variant="bodyStrong" style={{ flex: 1 }}>
                  {row.name} · {Math.round(row.share * 100)}%
                </AppText>
                <AppText variant="bodyStrong" color={over ? c.negative : undefined}>{formatRM(row.total)}</AppText>
              </View>
              <ProgressBar fraction={limit ? row.total / limit : row.share} color={over ? c.negative : undefined} />
              {limit !== undefined ? (
                <AppText variant="small" tone="muted">{t('reports.of', { limit: formatRM(limit) })}</AppText>
              ) : null}
            </View>
          );
        })}
        <Button title={t('reports.editBudget')} variant="secondary" compact onPress={() => router.push('/budget')} />
      </Card>

      <Card style={{ gap: 12 }}>
        <AppText variant="bodyStrong">{t('reports.year')} {year}</AppText>
        <AppText variant="small" tone="muted">{t('reports.yearHint')}</AppText>
        <AppText testID="year-total" variant="kpi">{formatRM(review.total)}</AppText>
        <AppText variant="small" tone="muted">{t('reports.yearTotal', { year })}</AppText>
        <BarChart
          height={80}
          highlight={`${key.slice(5)}`}
          bars={review.months.map((value, i) => ({
            key: String(i + 1).padStart(2, '0'),
            label: monthLabel(`${year}-${String(i + 1).padStart(2, '0')}`).slice(0, 1),
            value,
          }))}
        />
        <Stat label={t('reports.average')} value={formatRM(review.averagePerMonth)} />
        <Stat
          label={t('reports.busiest')}
          value={review.busiestMonth ? monthLabel(`${year}-${String(review.busiestMonth).padStart(2, '0')}`).split(' ')[0] : '-'}
        />
        <Stat
          label={t('reports.biggest')}
          value={review.biggest ? `${formatRM(review.biggest.amount)} · ${dayMonth(review.biggest.date)}` : '-'}
        />
        <Stat label={t('reports.count')} value={String(review.count)} />
      </Card>

      <Card style={{ gap: 10 }}>
        <AppText variant="bodyStrong">{t('reports.exportTitle')}</AppText>
        <AppText variant="small" tone="muted">{t('reports.exportHint', { year })}</AppText>
        <Button title={t('reports.pdf')} variant="secondary" onPress={() => exportAs('pdf')} />
        <Button title={t('reports.csv')} variant="secondary" onPress={() => exportAs('csv')} />
        {error ? <AppText variant="small" tone="negative">{error}</AppText> : null}
      </Card>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <AppText tone="muted">{label}</AppText>
      <AppText variant="bodyStrong" style={{ flexShrink: 1, textAlign: 'right' }}>{value}</AppText>
    </View>
  );
}
