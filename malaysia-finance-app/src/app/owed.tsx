import { useState } from 'react';
import { View } from 'react-native';
import { formatRM } from '@/domain/money';
import { settleUp, splitEntries, type OwedEntry } from '@/domain/owed';
import { OwedSheet } from '@/features/owed/OwedSheet';
import { balanceText, PersonSheet } from '@/features/owed/PersonSheet';
import { SplitSheet, type SplitInput } from '@/features/owed/SplitSheet';
import { ListRow } from '@/features/wealth/ListRow';
import { useCategories } from '@/hooks/useCategories';
import { useExpenses } from '@/hooks/useExpenses';
import { useOwed } from '@/hooks/useOwed';
import { useToday } from '@/hooks/useToday';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { confirmDelete } from '@/ui/confirm';
import { EmptyState } from '@/ui/EmptyState';
import { HeroCard, onHero } from '@/ui/HeroCard';
import { Screen } from '@/ui/Screen';

type Sheet =
  | { type: 'entry'; key: number; entry: OwedEntry | null; person?: string }
  | { type: 'split'; key: number };

export default function Owed() {
  const today = useToday();
  const { people, totals, add, update, remove } = useOwed();
  const { add: addExpense } = useExpenses();
  const { data: categories } = useCategories();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const names = people.map((p) => p.person);
  const openPerson = people.find((p) => p.person === open) ?? null;

  async function removeEntry(e: OwedEntry): Promise<boolean> {
    if (!(await confirmDelete(t('owed.deleteTitle'), t('owed.deleteMessage'), t('common.delete'), t('common.cancel')))) return false;
    await remove(e.id);
    return true;
  }

  async function saveSplit(input: SplitInput) {
    const { mine, entries } = splitEntries({ total: input.total, others: input.others, date: today, note: input.note });
    for (const entry of entries) await add(entry);
    if (input.categoryId !== null && mine > 0) {
      await addExpense({ amount: mine, categoryId: input.categoryId, date: today, note: input.note, receiptUri: null });
    }
  }

  return (
    <Screen>
      <BackButton />
      <AppText variant="title">{t('owed.title')}</AppText>
      <HeroCard style={{ gap: 12 }}>
        <View style={{ gap: 4 }}>
          <AppText variant="eyebrow" color={onHero.soft}>{t('owed.owedToMe')}</AppText>
          <AppText testID="owed-total" variant="kpi" color={onHero.ink}>{formatRM(totals.owedToMe)}</AppText>
        </View>
        {totals.iOwe > 0 ? (
          <AppText testID="owed-iowe" variant="small" tone="muted">{t('owed.iOwe')}: {formatRM(totals.iOwe)}</AppText>
        ) : null}
      </HeroCard>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button title={t('owed.add')} onPress={() => setSheet({ type: 'entry', key: Date.now(), entry: null })} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title={t('owed.split')} variant="secondary" onPress={() => setSheet({ type: 'split', key: Date.now() })} />
        </View>
      </View>

      {people.length === 0 ? (
        <EmptyState icon="people" text={t('owed.empty')} hint={t('owed.emptyHint')} />
      ) : (
        <Card style={{ padding: 0 }}>
          {people.map((p, i) => (
            <ListRow
              key={p.person}
              first={i === 0}
              title={p.person}
              subtitle={balanceText(p.balance)}
              value={p.balance === 0 ? undefined : formatRM(Math.abs(p.balance))}
              valueTone={p.balance > 0 ? 'positive' : 'negative'}
              onPress={() => setOpen(p.person)}
            />
          ))}
        </Card>
      )}

      {openPerson && !sheet ? (
        <PersonSheet
          person={openPerson}
          onClose={() => setOpen(null)}
          onSettle={async () => {
            const entry = settleUp(openPerson, today);
            if (entry) await add(entry);
          }}
          onAdd={() => setSheet({ type: 'entry', key: Date.now(), entry: null, person: openPerson.person })}
          onEdit={(entry) => setSheet({ type: 'entry', key: Date.now(), entry })}
        />
      ) : null}
      {sheet?.type === 'entry' ? (
        <OwedSheet
          key={sheet.key}
          existing={sheet.entry}
          person={sheet.person}
          people={names}
          today={today}
          onClose={() => setSheet(null)}
          onSave={async (input) => {
            if (sheet.entry) await update({ ...sheet.entry, ...input });
            else await add(input);
          }}
          onDelete={sheet.entry ? () => removeEntry(sheet.entry!) : undefined}
        />
      ) : null}
      {sheet?.type === 'split' ? (
        <SplitSheet key={sheet.key} people={names} categories={categories} onClose={() => setSheet(null)} onSave={saveSplit} />
      ) : null}
    </Screen>
  );
}
