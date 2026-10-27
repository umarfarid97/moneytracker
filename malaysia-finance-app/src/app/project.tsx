import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { shortDate } from '@/domain/dates';
import { formatRM } from '@/domain/money';
import { entryOf, isDefaultProject, normalizeName, sameName, splitTransfers, transferOf, type OwedEntry, type Transfer } from '@/domain/owed';
import { projectName } from '@/features/owed/projectName';
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

type Sheet =
  | { type: 'entry'; key: number; entry: OwedEntry | null }
  | { type: 'split'; key: number }
  | { type: 'edit'; key: number }
  | { type: 'share'; key: number };

export default function Project() {
  const today = useToday();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { projects, people, projectOps, add, update, remove } = useOwed();
  const { add: addExpense } = useExpenses();
  const { data: categories } = useCategories();
  const [sheet, setSheet] = useState<Sheet | null>(null);
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

  async function saveSplit(input: SplitInput) {
    for (const part of input.parts) await addMember(part.name);
    for (const p of input.paid) await addMember(p.name);
    // Everyone who paid more than their part is owed by those who paid less; one entry per payment that squares it.
    for (const tr of splitTransfers({ paid: input.paid, parts: input.parts, mine: input.mine })) {
      await add({ ...entryOf(tr), date: today, note: input.note, projectId });
    }
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

  async function removeProject(): Promise<boolean> {
    if (!(await confirmDelete(t('project.deleteTitle'), t('project.deleteMessage'), t('common.delete'), t('common.cancel')))) return false;
    await projectOps.remove(project.id);
    router.back();
    return false;
  }

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
          <Button title={t('owed.split')} variant="secondary" onPress={() => setSheet({ type: 'split', key: Date.now() })} />
        </View>
      </View>
      <Button title={t('project.share')} variant="secondary" onPress={() => setSheet({ type: 'share', key: Date.now() })} />

      {summary.entries.length > 0 ? (
        <View style={{ gap: 8 }}>
          <AppText variant="eyebrow" tone="muted">{t('project.entries')}</AppText>
          <Card style={{ gap: 14 }}>
            {summary.entries.map((e) => (
              <PressableScale
                key={e.id}
                accessibilityRole="button"
                accessibilityLabel={transferText(transferOf(e))}
                onPress={() => setSheet({ type: 'entry', key: Date.now(), entry: e })}
                pressedScale={0.99}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">{transferText(transferOf(e))}</AppText>
                  <AppText variant="small" tone="muted">{[shortDate(e.date), e.note].filter(Boolean).join(' · ')}</AppText>
                </View>
                {(() => {
                  const tr = transferOf(e);
                  const gain = tr.from === '' ? 1 : tr.to === '' ? -1 : 0;
                  return (
                    <AppText variant="bodyStrong" tone={gain > 0 ? 'positive' : gain < 0 ? 'negative' : 'muted'}>
                      {gain > 0 ? '+' : gain < 0 ? '-' : ''}{formatRM(e.amount)}
                    </AppText>
                  );
                })()}
              </PressableScale>
            ))}
          </Card>
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
        <SplitSheet key={sheet.key} people={summary.everyone} categories={categories} onClose={() => setSheet(null)} onSave={saveSplit} />
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
