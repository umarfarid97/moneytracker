import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { daysLeftInPeriod, parseStartDay, periodKey, periodLabel } from '@/domain/budgetPeriod';
import { formatRM, parseRM, senToInput } from '@/domain/money';
import { buildHome, type BudgetTile } from '@/domain/summary';
import { useExpenses } from '@/hooks/useExpenses';
import { useBudgets } from '@/hooks/useBudgets';
import { useCategories } from '@/hooks/useCategories';
import { useProfile } from '@/hooks/useProfile';
import { useToday } from '@/hooks/useToday';
import { getLanguage } from '@/i18n/language';
import { t } from '@/i18n/t';
import { AmountInput } from '@/ui/AmountInput';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { ProgressBar } from '@/ui/ProgressBar';
import { Screen } from '@/ui/Screen';
import { controlHeight, fontFamily, radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { sanitizeNumber } from '@/ui/numeric';

const PAYDAY_CHOICES = [{ day: 1 }, { day: 15 }, { day: 25 }, { day: 28 }, { day: 31 }];
const ordinal = (n: number) => getLanguage() === 'ms' ? String(n) : `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`;

export default function Budget() {
  const { c } = useTheme();
  const today = useToday();
  const { data: profile, save: saveProfile } = useProfile();
  const startDay = profile.budgetStartDay;
  const month = periodKey(today, startDay);
  const { data: categories } = useCategories();
  const { data: budgets, set, remove, copyFromLast } = useBudgets(month);
  const { data: expenses } = useExpenses();
  const { tiles } = useMemo(
    () => buildHome({ categories, expenses, budgets, today, startDay }),
    [categories, expenses, budgets, today, startDay],
  );
  const budgeted = tiles.filter((x): x is BudgetTile => x.limit !== null);
  const warnings = budgeted.filter((x) => x.status !== 'on-track');

  const saved = useMemo(
    () => Object.fromEntries(budgets.map((b) => [b.categoryId, senToInput(b.limit)])) as Record<number, string>,
    [budgets],
  );
  const [drafts, setDrafts] = useState<Record<number, string>>(saved);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Amounts are read-only until Edit budgets is tapped.
  const [editing, setEditing] = useState(false);
  const [dayText, setDayText] = useState(startDay === 1 ? '' : String(startDay));

  /** The budget period changes with the start day, so budgets already typed in are left as they were. */
  async function changeStartDay(day: number) {
    if (day === startDay) return;
    setError(null);
    try {
      await saveProfile({ ...profile, budgetStartDay: day });
      setDayText(PAYDAY_CHOICES.some((x) => x.day === day) ? '' : String(day));
    } catch {
      setError(t('common.saveFailed'));
    }
  }

  // When stored budgets change (first load, "copy last month"), show them in the fields.
  useEffect(() => setDrafts(saved), [saved]);

  const parsed = categories.map((c) => {
    const text = (drafts[c.id] ?? '').trim();
    return { category: c, text, sen: text === '' ? null : parseRM(text) };
  });
  const allValid = parsed.every((p) => p.text === '' || p.sen !== null);
  const total = parsed.reduce((sum, p) => sum + (p.sen ?? 0), 0);

  function cancelEdit() {
    setDrafts(saved);
    setError(null);
    setEditing(false);
  }

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
      setEditing(false);
    } catch {
      setError(t('common.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

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
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {PAYDAY_CHOICES.map((choice) => (
            <Chip
              key={choice.day}
              label={choice.day === 31 ? t('budget.startDay.last') : ordinal(choice.day)}
              accessibilityLabel={`Budget starts ${choice.day === 31 ? 'on the last day' : `on day ${choice.day}`}`}
              selected={startDay === choice.day}
              onPress={() => changeStartDay(choice.day)}
            />
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TextInput
            accessibilityLabel={t('budget.startDay.day')}
            value={dayText}
            onChangeText={(text) => setDayText(sanitizeNumber(text, 0))}
            keyboardType="number-pad"
            maxLength={2}
            placeholder={t('budget.startDay.day')}
            placeholderTextColor={c.muted}
            style={{
              flex: 1, height: controlHeight, borderRadius: radius.control, backgroundColor: c.surface,
              borderWidth: 1, borderColor: dayText !== '' && parseStartDay(dayText) === null ? c.negative : c.control,
              paddingHorizontal: 14, color: c.text, fontFamily: fontFamily.medium, fontSize: 16,
            }}
          />
          <Button
            title={t('budget.startDay.set')}
            variant="secondary"
            disabled={parseStartDay(dayText) === null || parseStartDay(dayText) === startDay}
            onPress={() => changeStartDay(parseStartDay(dayText)!)}
          />
        </View>
      </Card>
      <Card style={{ gap: 4 }}>
        <AppText variant="small" tone="muted">
          {t('budget.month')}
        </AppText>
        <AppText testID="budget-total" variant="kpi">
          {formatRM(total)}
        </AppText>
      </Card>
      {editing ? (
        <>
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
          {error ? (
            <AppText variant="small" tone="negative">
              {error}
            </AppText>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button title={t('common.cancel')} variant="secondary" onPress={cancelEdit} disabled={busy} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={t('common.save')} onPress={save} disabled={!allValid || busy} />
            </View>
          </View>
        </>
      ) : (
        <>
          <Card style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <AppText variant="bodyStrong" style={{ flex: 1 }}>{t('budget.amounts')}</AppText>
              <Chip compact icon="create-outline" label={t('budget.edit')} onPress={() => setEditing(true)} />
            </View>
            {parsed.map(({ category, sen }) => (
              <View key={category.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <AppText variant="body" style={{ flex: 1 }}>{category.name}</AppText>
                <AppText variant="bodyStrong" tone={sen === null ? 'muted' : undefined} testID={`budget-amount-${category.id}`}>
                  {sen === null ? t('budget.notSet') : formatRM(sen)}
                </AppText>
              </View>
            ))}
          </Card>
          {error ? (
            <AppText variant="small" tone="negative">
              {error}
            </AppText>
          ) : null}
          <Button title={t('budget.seeReport')} variant="secondary" onPress={() => router.push('/reports')} />
        </>
      )}
    </Screen>
  );
}
