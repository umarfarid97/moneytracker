import { useState } from 'react';
import { View } from 'react-native';
import { formatRM } from '@/domain/money';
import { NO_EVENT, sameName, settleUp, type OwedEntry, type PersonBalance } from '@/domain/owed';
import { EventSheet, eventTitle } from '@/features/owed/EventSheet';
import { OwedSheet } from '@/features/owed/OwedSheet';
import { balanceText, PersonSheet } from '@/features/owed/PersonSheet';
import { SplitSheet, type SplitInput } from '@/features/owed/SplitSheet';
import { ListRow } from '@/features/wealth/ListRow';
import { useCategories } from '@/hooks/useCategories';
import { useExpenses } from '@/hooks/useExpenses';
import { useOwed } from '@/hooks/useOwed';
import { useToday } from '@/hooks/useToday';
import { t } from '@/i18n/t';
import { Chip } from '@/ui/Chip';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { confirmDelete } from '@/ui/confirm';
import { EmptyState } from '@/ui/EmptyState';
import { HeroCard, onHero } from '@/ui/HeroCard';
import { Screen } from '@/ui/Screen';

type Sheet =
  | { type: 'entry'; key: number; entry: OwedEntry | null; person?: string; event?: string }
  | { type: 'split'; key: number; event?: string };

export default function Owed() {
  const today = useToday();
  const { people, events, totals, add, update, remove } = useOwed();
  const { add: addExpense } = useExpenses();
  const { data: categories } = useCategories();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [openEvent, setOpenEvent] = useState<string | null>(null);
  const [view, setView] = useState<'event' | 'person'>('event');
  const names = people.map((p) => p.person);
  const eventNames = events.filter((e) => e.event !== NO_EVENT).map((e) => e.event);
  const eventSummary = openEvent === null ? null : events.find((e) => sameName(e.event, openEvent)) ?? null;
  const openPerson = people.find((p) => p.person === open) ?? null;

  async function removeEntry(e: OwedEntry): Promise<boolean> {
    if (!(await confirmDelete(t('owed.deleteTitle'), t('owed.deleteMessage'), t('common.delete'), t('common.cancel')))) return false;
    await remove(e.id);
    return true;
  }

  async function saveSplit(input: SplitInput) {
    for (const part of input.parts) {
      await add({ person: part.name, kind: 'lent', amount: part.amount, date: today, note: input.note, event: input.event });
    }
    if (input.categoryId !== null && input.mine > 0) {
      await addExpense({ amount: input.mine, categoryId: input.categoryId, date: today, note: input.note, receiptUri: null });
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

      {people.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label={t('owed.view.event')} selected={view === 'event'} onPress={() => setView('event')} />
          <Chip label={t('owed.view.person')} selected={view === 'person'} onPress={() => setView('person')} />
        </View>
      ) : null}

      {people.length === 0 ? (
        <EmptyState icon="people" text={t('owed.empty')} hint={t('owed.emptyHint')} />
      ) : view === 'event' ? (
        <Card style={{ padding: 0 }}>
          {events.map((e, i) => {
            const net = e.owedToMe - e.iOwe;
            return (
              <ListRow
                key={e.event || '(none)'}
                first={i === 0}
                title={eventTitle(e.event)}
                subtitle={[
                  t(e.people.length === 1 ? 'owed.onePerson' : 'owed.people', { count: e.people.length }),
                  net > 0 ? t('owed.netOwed', { amount: formatRM(net) }) : net < 0 ? t('owed.netIOwe', { amount: formatRM(-net) }) : t('owed.settled'),
                ].join(' · ')}
                value={net === 0 ? undefined : formatRM(Math.abs(net))}
                valueTone={net > 0 ? 'positive' : 'negative'}
                onPress={() => setOpenEvent(e.event)}
              />
            );
          })}
        </Card>
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

      {eventSummary && !sheet ? (
        <EventSheet
          summary={eventSummary}
          onClose={() => setOpenEvent(null)}
          onAdd={() => setSheet({ type: 'entry', key: Date.now(), entry: null, event: eventSummary.event })}
          onSplit={() => setSheet({ type: 'split', key: Date.now(), event: eventSummary.event })}
          onSettle={async (p: PersonBalance) => {
            const entry = settleUp(p, today, eventSummary.event);
            if (entry) await add(entry);
          }}
          onEdit={(entry) => setSheet({ type: 'entry', key: Date.now(), entry })}
        />
      ) : null}
      {openPerson && !sheet && !eventSummary ? (
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
          event={sheet.event}
          events={eventNames}
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
        <SplitSheet key={sheet.key} people={names} events={eventNames} event={sheet.event} categories={categories} onClose={() => setSheet(null)} onSave={saveSplit} />
      ) : null}
    </Screen>
  );
}
