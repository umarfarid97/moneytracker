import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { periodKey, periodLabel } from '@/domain/budgetPeriod';
import { formatRM, parseRM, senToInput } from '@/domain/money';
import { useBudgets } from '@/hooks/useBudgets';
import { useCategories } from '@/hooks/useCategories';
import { useProfile } from '@/hooks/useProfile';
import { useToday } from '@/hooks/useToday';
import { t } from '@/i18n/t';
import { AmountInput } from '@/ui/AmountInput';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

/** Edit the budget amount of every category for the current budget period. */
export default function BudgetEdit() {
  const today = useToday();
  const { data: profile } = useProfile();
  const startDay = profile.budgetStartDay;
  const month = periodKey(today, startDay);
  const { data: categories } = useCategories();
  const { data: budgets, set, remove, copyFromLast } = useBudgets(month);

  const saved = useMemo(
    () => Object.fromEntries(budgets.map((b) => [b.categoryId, senToInput(b.limit)])) as Record<number, string>,
    [budgets],
  );
  const [drafts, setDrafts] = useState<Record<number, string>>(saved);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // When stored budgets change (first load, "copy last month"), show them in the fields.
  useEffect(() => setDrafts(saved), [saved]);

  const parsed = categories.map((category) => {
    const text = (drafts[category.id] ?? '').trim();
    return { category, text, sen: text === '' ? null : parseRM(text) };
  });
  const allValid = parsed.every((p) => p.text === '' || p.sen !== null);
  const total = parsed.reduce((sum, p) => sum + (p.sen ?? 0), 0);

  async function save() {
    if (!allValid || busy) return;
    setBusy(true);
    setError(null);
    try {
      for (const { category, text, sen } of parsed) {
        const existing = budgets.find((b) => b.categoryId === category.id);
        if (text === '') {
          if (existing) await remove(category.id);
        } else if (sen !== null && sen !== existing?.limit) {
          await set({ categoryId: category.id, month, limit: sen });
        }
      }
      router.back();
    } catch {
      setError(t('common.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      footer={(
        <View style={{ gap: 8 }}>
          {error ? <AppText variant="small" tone="negative">{error}</AppText> : null}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button title={t('common.cancel')} variant="secondary" onPress={() => router.back()} disabled={busy} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={t('common.save')} onPress={save} disabled={!allValid || busy} />
            </View>
          </View>
        </View>
      )}
    >
      <BackButton />
      <View style={{ gap: 4 }}>
        <AppText variant="title">{t('budget.edit')}</AppText>
        <AppText variant="bodyStrong" tone="muted">{periodLabel(month, startDay)}</AppText>
      </View>
      <Card style={{ gap: 4 }}>
        <AppText variant="small" tone="muted">{t('budget.month')}</AppText>
        <AppText testID="budget-total" variant="kpi">{formatRM(total)}</AppText>
      </Card>
      <Button title={t('budget.copyLast')} variant="secondary" onPress={() => copyFromLast().catch(() => setError(t('common.saveFailed')))} />
      <View style={{ gap: 16 }}>
        {parsed.map(({ category }) => (
          <AmountInput
            key={category.id}
            label={category.name}
            value={drafts[category.id] ?? ''}
            onChange={(next) => setDrafts((prev) => ({ ...prev, [category.id]: next }))}
          />
        ))}
      </View>
    </Screen>
  );
}
