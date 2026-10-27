import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { dayLabel, shortDate } from '@/domain/dates';
import { formatRM } from '@/domain/money';
import { billPeople, encodeBill, entryOf, groupEntries, isDefaultProject, sectionEntries, normalizeName, sameName, splitTransfers, transferOf, type EntryItem, type OwedEntry, type Transfer } from '@/domain/owed';
import { projectName } from '@/features/owed/projectName';
import { BillCard } from '@/features/owed/BillCard';
import { OwedSheet } from '@/features/owed/OwedSheet';
import { payText, transferText, whoName } from '@/features/owed/sentences';
import { ProjectSheet } from '@/features/owed/ProjectSheet';
import { ShareSheet } from '@/features/owed/ShareSheet';
import { SplitSheet, type SplitInput } from '@/features/owed/SplitSheet';
import { useCategories } from '@/hooks/useCategories';
import { useExpenses } from '@/hooks/useExpenses';
import { useOwed } from '@/hooks/useOwed';
import { useToday } from '@/hooks/useToday';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { confirmDelete } from '@/ui/confirm';
import { HeroCard, onHero } from '@/ui/HeroCard';
import { PressableScale } from '@/ui/PressableScale';
import { Screen } from '@/ui/Screen';
import { useTheme } from '@/ui/useTheme';

type Sheet =
  | { type: 'entry'; key: number; entry: OwedEntry | null }
  | { type: 'split'; key: number; bill: Extract<EntryItem, { type: 'bill' }> | null }
  | { type: 'edit'; key: number }
  | { type: 'share'; key: number };

export default function Project() {
  const today = useToday();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { projects, people, projectOps, add, update, remove } = useOwed();
  const { add: addExpense } = useExpenses();
  const { data: categories } = useCategories();
  const { c } = useTheme();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [showPayments, setShowPayments] = useState(false);
  const summary = projects.find((p) => p.project.id === Number(id));

  if (!summary) {
    return (
      <Screen>
        <BackButton />
        <AppText variant="body" tone="muted">{t('project.missing')}</AppText>
      </Screen>
    );
  }
  const { project } = summary;
  const title = projectName(project);
  const projectId = project.id;

  async function addMember(name: string) {
    const n = normalizeName(name);
    if (n !== '' && !summary!.everyone.some((m) => sameName(m, n))) await projectOps.update({ ...project, members: [...project.members, n] });
  }

  async function saveSplit(input: SplitInput, replacing: Extract<EntryItem, { type: 'bill' }> | null) {
    for (const part of input.parts) await addMember(part.name);
    for (const p of input.paid) await addMember(p.name);
    // Every entry of the bill carries the original bill, so the list can show them as one item.
    const bill = encodeBill({
      id: replacing?.bill.id ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      total: input.total, paid: input.paid, parts: input.parts, mine: input.mine,
      mode: input.mode, typed: input.typed, myShares: input.myShares,
    });
    const date = replacing?.date ?? today;
    // Everyone who paid more than their part is owed by those who paid less; one entry per payment that squares it.
    for (const tr of splitTransfers({ paid: input.paid, parts: input.parts, mine: input.mine })) {
      await add({ ...entryOf(tr), date, note: input.note, projectId, bill });
    }
    if (replacing) for (const e of replacing.entries) await remove(e.id);
    if (input.categoryId !== null && input.mine > 0) {
      await addExpense({ amount: input.mine, categoryId: input.categoryId, date: today, note: input.note || title, receiptUri: null });
    }
  }

  async function markPaid(tr: Transfer) {
    await add({ ...entryOf({ ...tr, type: 'payback' }), date: today, note: '', projectId });
  }

  async function removeEntry(e: OwedEntry): Promise<boolean> {
    if (!(await confirmDelete(t('owed.deleteTitle'), t('owed.deleteMessage'), t('common.delete'), t('common.cancel')))) return false;
    await remove(e.id);
    return true;
  }

  async function removeBill(item: Extract<EntryItem, { type: 'bill' }>) {
    if (!(await confirmDelete(t('bill.deleteTitle'), t('bill.deleteMessage'), t('common.delete'), t('common.cancel')))) return;
    for (const e of item.entries) await remove(e.id);
  }

  async function removeProject(): Promise<boolean> {
    if (!(await confirmDelete(t('project.deleteTitle'), t('project.deleteMessage'), t('common.delete'), t('common.cancel')))) return false;
    await projectOps.remove(project.id);
    router.back();
    return false;
  }

  /** An IOU: green when it is owed to you, red when you owe, plain between other people. Payments are quieter: muted, no sign. */
  const entryRow = (e: OwedEntry, payment = false) => {
    const tr = transferOf(e);
    const gain = tr.from === '' ? 1 : tr.to === '' ? -1 : 0;
    return (
      <PressableScale
        key={e.id}
        accessibilityRole="button"
        accessibilityLabel={transferText(tr)}
        onPress={() => setSheet({ type: 'entry', key: Date.now(), entry: e })}
        pressedScale={0.99}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
      >
        <Ionicons name={payment ? 'swap-horizontal-outline' : 'person-outline'} size={payment ? 18 : 22} color={payment ? c.muted : c.text} />
        <View style={{ flex: 1 }}>
          <AppText variant={payment ? 'small' : 'bodyStrong'} tone={payment ? 'muted' : undefined}>{transferText(tr)}</AppText>
          {e.note ? <AppText variant="small" tone="muted" numberOfLines={1}>{e.note}</AppText> : null}
        </View>
        <AppText variant={payment ? 'small' : 'bodyStrong'} tone={payment ? 'muted' : gain > 0 ? 'positive' : gain < 0 ? 'negative' : undefined}>
          {formatRM(e.amount)}
        </AppText>
      </PressableScale>
    );
  };

  const sections = sectionEntries(groupEntries(summary.entries));

  const dates = project.startDate
    ? `${shortDate(project.startDate)}${project.endDate && project.endDate !== project.startDate ? ` - ${shortDate(project.endDate)}` : ''}`
    : null;
  const others = people.map((p) => p.person);
  const suggestions = others.filter((n) => !summary.everyone.some((m) => sameName(m, n)));

  return (
    <Screen>
      <BackButton />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <AppText variant="title" style={{ flex: 1 }}>{title}</AppText>
        <Chip compact icon="create-outline" label={t('common.edit')} accessibilityLabel={t('project.edit')} onPress={() => setSheet({ type: 'edit', key: Date.now() })} />
      </View>
      {dates ? <AppText variant="small" tone="muted">{dates}</AppText> : null}

      <HeroCard style={{ gap: 12 }}>
        <View style={{ gap: 4 }}>
          <AppText variant="eyebrow" color={onHero.soft}>{t('owed.owedToMe')}</AppText>
          <AppText testID="project-owed" variant="kpi" color={onHero.ink}>{formatRM(summary.owedToMe)}</AppText>
        </View>
        {summary.iOwe > 0 ? <AppText testID="project-iowe" variant="small" tone="muted">{t('owed.iOwe')}: {formatRM(summary.iOwe)}</AppText> : null}
      </HeroCard>

      <View style={{ gap: 8 }}>
        <AppText variant="eyebrow" tone="muted">{t('project.people')}</AppText>
        {summary.everyone.length === 0 ? (
          <AppText variant="small" tone="muted">{t('project.noPeople')}</AppText>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {summary.everyone.map((n) => <Chip key={n} compact label={n} />)}
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button title={t('owed.add')} onPress={() => setSheet({ type: 'entry', key: Date.now(), entry: null })} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title={t('owed.split')} variant="secondary" onPress={() => setSheet({ type: 'split', key: Date.now(), bill: null })} />
        </View>
      </View>
      <Button title={t('project.share')} variant="secondary" onPress={() => setSheet({ type: 'share', key: Date.now() })} />

      {sections.days.length > 0 ? (
        <View style={{ gap: 8 }}>
          <AppText variant="eyebrow" tone="muted">{t('project.entries')}</AppText>
          <Card style={{ gap: 14 }}>
            {sections.days.map((day) => (
              <View key={day.date} testID="entries-day" style={{ gap: 12 }}>
                <AppText variant="small" tone="muted">{dayLabel(day.date, today)}</AppText>
                {day.items.map((item) => item.type === 'bill' ? (
                  <BillCard
                    key={item.bill.id}
                    item={item}
                    onEdit={() => setSheet({ type: 'split', key: Date.now(), bill: item })}
                    onDelete={() => removeBill(item)}
                  />
                ) : entryRow(item.entry))}
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {sections.payments.length > 0 ? (
        <View style={{ gap: 8 }}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('project.payments', { count: sections.payments.length })}
            accessibilityState={{ expanded: showPayments }}
            onPress={() => setShowPayments((o) => !o)}
            pressedScale={0.99}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <AppText variant="eyebrow" tone="muted">{t('project.payments', { count: sections.payments.length })}</AppText>
            <Ionicons name={showPayments ? 'chevron-up' : 'chevron-down'} size={14} color={c.muted} />
          </PressableScale>
          {showPayments ? <Card style={{ gap: 12 }}>{sections.payments.map((e) => entryRow(e, true))}</Card> : null}
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <AppText variant="eyebrow" tone="muted">{t('book.summary')}</AppText>
        {summary.net.length === 0 ? (
          <AppText testID="book-settled" variant="small" tone="muted">{t('book.allSettled')}</AppText>
        ) : (
          <>
            <Card style={{ gap: 12 }}>
              {summary.net.map((p) => (
                <View key={p.name || 'me'} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyStrong">{whoName(p.name)}</AppText>
                    <AppText variant="small" tone="muted">{t(p.net > 0 ? 'book.getsBack' : 'book.needsToPay')}</AppText>
                  </View>
                  <AppText variant="bodyStrong" tone={p.net > 0 ? 'positive' : 'negative'}>{p.net > 0 ? '+' : '-'}{formatRM(Math.abs(p.net))}</AppText>
                </View>
              ))}
            </Card>
            <AppText variant="eyebrow" tone="muted">{t('book.toSettle')}</AppText>
            <Card style={{ gap: 12 }}>
              {summary.settlements.map((tr) => (
                <View key={`${tr.from}|${tr.to}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <AppText testID="book-payment" variant="bodyStrong" style={{ flex: 1 }}>{payText(tr)}</AppText>
                  <Chip compact label={t('book.markPaid')} accessibilityLabel={`${t('book.markPaid')}: ${payText(tr)}`} onPress={() => markPaid(tr)} />
                </View>
              ))}
            </Card>
          </>
        )}
      </View>

      {sheet?.type === 'entry' ? (
        <OwedSheet
          key={sheet.key}
          existing={sheet.entry}
          projectId={projectId}
          people={summary.everyone}
          today={today}
          onClose={() => setSheet(null)}
          onSave={async (input) => {
            await addMember(input.person);
            if (sheet.entry) await update({ ...sheet.entry, ...input });
            else await add(input);
          }}
          onDelete={sheet.entry ? () => removeEntry(sheet.entry!) : undefined}
        />
      ) : null}
      {sheet?.type === 'split' ? (
        <SplitSheet
          key={sheet.key}
          people={summary.everyone}
          categories={categories}
          existing={sheet.bill ? { bill: sheet.bill.bill, note: sheet.bill.note } : null}
          onClose={() => setSheet(null)}
          onSave={(input) => saveSplit(input, sheet.bill)}
        />
      ) : null}
      {sheet?.type === 'edit' ? (
        <ProjectSheet
          key={sheet.key}
          existing={project}
          suggestions={suggestions}
          today={today}
          onClose={() => setSheet(null)}
          onSave={(input) => projectOps.update({ ...project, ...input, name: isDefaultProject(project) ? project.name : input.name })}
          onDelete={isDefaultProject(project) ? undefined : removeProject}
        />
      ) : null}
      {sheet?.type === 'share' ? (
        <ShareSheet
          key={sheet.key}
          project={project}
          entries={summary.entries}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </Screen>
  );
}
