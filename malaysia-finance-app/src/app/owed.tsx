import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { formatRM } from '@/domain/money';
import { settleUp, type PersonBalance } from '@/domain/owed';
import { projectName } from '@/features/owed/projectName';
import { balanceText, PersonSheet } from '@/features/owed/PersonSheet';
import { ImportSheet } from '@/features/owed/ImportSheet';
import { ProjectSheet } from '@/features/owed/ProjectSheet';
import { ListRow } from '@/features/wealth/ListRow';
import { useOwed } from '@/hooks/useOwed';
import { useToday } from '@/hooks/useToday';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { HeroCard, onHero } from '@/ui/HeroCard';
import { Screen } from '@/ui/Screen';

type Sheet = { type: 'new'; key: number } | { type: 'import'; key: number };

function goToProject(id: number) {
  router.push({ pathname: '/project', params: { id: String(id) } });
}

/** Buku 555: every project (a trip, a dinner) with the money lent, borrowed and split in it, and the balance per person. */
export default function Owed() {
  const today = useToday();
  const { people, projects, projectOps, totals, add } = useOwed();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [view, setView] = useState<'project' | 'person'>('project');
  const openPerson = people.find((p) => p.person === open) ?? null;
  const knownPeople = people.map((p) => p.person);
  const nameOf = (id: number) => {
    const found = projects.find((p) => p.project.id === id)?.project;
    return found ? projectName(found) : '';
  };

  async function settleEverywhere(person: PersonBalance) {
    // One settling entry per project the person still has a balance in.
    for (const s of projects) {
      const inProject = s.people.find((p) => p.person === person.person);
      const entry = inProject ? settleUp(inProject, today, s.project.id) : null;
      if (entry) await add(entry);
    }
  }

  return (
    <Screen>
      <BackButton />
      <AppText variant="title">{t('owed.title')}</AppText>
      <AppText variant="small" tone="muted">{t('owed.about')}</AppText>
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
          <Button title={t('owed.newProject')} onPress={() => setSheet({ type: 'new', key: Date.now() })} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title={t('owed.importProject')} variant="secondary" onPress={() => setSheet({ type: 'import', key: Date.now() })} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label={t('owed.view.project')} selected={view === 'project'} onPress={() => setView('project')} />
        <Chip label={t('owed.view.person')} selected={view === 'person'} onPress={() => setView('person')} />
      </View>

      {view === 'project' ? (
        <Card style={{ padding: 0 }}>
          {projects.map((s, i) => {
            const net = s.owedToMe - s.iOwe;
            const count = s.everyone.length;
            return (
              <ListRow
                key={s.project.id}
                first={i === 0}
                title={projectName(s.project)}
                subtitle={[
                  count === 0 ? t('project.people.none') : t(count === 1 ? 'project.people.one' : 'project.people.count', { count }),
                  net > 0 ? t('owed.netOwed', { amount: formatRM(net) }) : net < 0 ? t('owed.netIOwe', { amount: formatRM(-net) }) : t('owed.settled'),
                ].join(' · ')}
                value={net === 0 ? undefined : formatRM(Math.abs(net))}
                valueTone={net > 0 ? 'positive' : 'negative'}
                onPress={() => goToProject(s.project.id)}
              />
            );
          })}
        </Card>
      ) : people.length === 0 ? (
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
          projectName={nameOf}
          onClose={() => setOpen(null)}
          onSettle={() => settleEverywhere(openPerson)}
          onEdit={(entry) => { setOpen(null); goToProject(entry.projectId); }}
        />
      ) : null}
      {sheet?.type === 'new' ? (
        <ProjectSheet
          key={sheet.key}
          existing={null}
          suggestions={knownPeople}
          today={today}
          onClose={() => setSheet(null)}
          onSave={async (input) => {
            const saved = await projectOps.add(input);
            goToProject(saved.id);
          }}
        />
      ) : null}
      {sheet?.type === 'import' ? (
        <ImportSheet
          key={sheet.key}
          onClose={() => setSheet(null)}
          onImport={async (project, entries) => {
            const saved = await projectOps.add(project);
            for (const e of entries) await add({ ...e, projectId: saved.id });
            goToProject(saved.id);
          }}
        />
      ) : null}
    </Screen>
  );
}
