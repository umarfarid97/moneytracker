import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, TextInput, View, type TextStyle } from 'react-native';
import { periodKey, periodLabel } from '@/domain/budgetPeriod';
import { formatRM, parseRM, senToInput } from '@/domain/money';
import { useBudgets } from '@/hooks/useBudgets';
import { useCategories } from '@/hooks/useCategories';
import { useProfile } from '@/hooks/useProfile';
import { useToday } from '@/hooks/useToday';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { sanitizeNumber } from '@/ui/numeric';
import { Screen } from '@/ui/Screen';
import { fontFamily, radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

/** Browsers draw their own focus ring inside the field. */
const NO_WEB_OUTLINE = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as TextStyle;

/** Edit the budget amount of every category for the current budget period. */
export default function BudgetEdit() {
  const { c } = useTheme();
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
      <Card style={{ paddingVertical: 4 }}>
        {parsed.map(({ category, text, sen }, i) => {
          const invalid = text !== '' && sen === null;
          return (
            <View
              key={category.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 8,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: c.border,
              }}
            >
              <AppText variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>{category.name}</AppText>
              <View
                style={{
                  width: 140,
                  height: 40,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 10,
                  borderRadius: radius.control,
                  borderWidth: 1,
                  borderColor: invalid ? c.negative : c.control,
                  backgroundColor: c.surface,
                }}
              >
                <AppText variant="smallStrong" tone="muted">RM</AppText>
                <TextInput
                  accessibilityLabel={category.name}
                  value={drafts[category.id] ?? ''}
                  onChangeText={(raw) => setDrafts((prev) => ({ ...prev, [category.id]: sanitizeNumber(raw) }))}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  placeholder={t('amount.placeholder')}
                  placeholderTextColor={c.muted}
                  style={[
                    { flex: 1, minWidth: 0, textAlign: 'right', color: c.text, fontFamily: fontFamily.medium, fontSize: 15, fontVariant: ['tabular-nums'] },
                    NO_WEB_OUTLINE,
                  ]}
                />
              </View>
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}
