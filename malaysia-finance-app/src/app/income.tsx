import { useState } from 'react';
import { View } from 'react-native';
import { shortDate } from '@/domain/dates';
import type { IncomeEntry, IncomeRule } from '@/domain/income';
import { formatRM } from '@/domain/money';
import { EntrySheet, RuleSheet } from '@/features/income/IncomeSheets';
import { ListRow } from '@/features/wealth/ListRow';
import { useIncome } from '@/hooks/useIncome';
import { useToday } from '@/hooks/useToday';
import type { StringKey } from '@/i18n/en';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { confirmDelete } from '@/ui/confirm';
import { EmptyState } from '@/ui/EmptyState';
import { HeroCard } from '@/ui/HeroCard';
import { Screen } from '@/ui/Screen';
import { useTheme } from '@/ui/useTheme';

type Sheet = { type: 'rule'; key: number; rule: IncomeRule | null } | { type: 'entry'; key: number; entry: IncomeEntry | null };

export default function Income() {
  const { c } = useTheme();
  const today = useToday();
  const { rules, ruleOps, entries, entryOps, received } = useIncome(today.slice(0, 7));
  const [sheet, setSheet] = useState<Sheet | null>(null);

  async function confirmRemove(title: StringKey, message: StringKey, remove: () => Promise<void>): Promise<boolean> {
    if (!(await confirmDelete(t(title), t(message), t('common.delete'), t('common.cancel')))) return false;
    await remove();
    return true;
  }

  return (
    <Screen>
      <BackButton />
      <AppText variant="title">{t('income.title')}</AppText>
      <HeroCard style={{ gap: 8 }}>
        <AppText variant="eyebrow" color={c.heroSoft}>{t('income.thisMonth')}</AppText>
        <AppText testID="income-month" variant="kpi" color={c.heroInk}>{formatRM(received)}</AppText>
        <AppText variant="small" tone="muted">{t('income.hint')}</AppText>
      </HeroCard>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button title={t('income.addRule')} onPress={() => setSheet({ type: 'rule', key: Date.now(), rule: null })} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title={t('income.addOnce')} variant="secondary" onPress={() => setSheet({ type: 'entry', key: Date.now(), entry: null })} />
        </View>
      </View>

      {rules.length === 0 && entries.length === 0 ? (
        <EmptyState icon="cash" text={t('income.empty')} hint={t('income.emptyHint')} />
      ) : null}

      {rules.length > 0 ? (
        <View style={{ gap: 8 }}>
          <AppText variant="eyebrow" tone="muted">{t('income.repeating')}</AppText>
          <Card style={{ padding: 0 }}>
            {rules.map((r, i) => (
              <ListRow
                key={r.id}
                first={i === 0}
                title={r.name}
                subtitle={r.active ? t('income.everyMonth', { day: r.dayOfMonth }) : t('income.paused')}
                value={formatRM(r.amount)}
                valueTone="positive"
                onPress={() => setSheet({ type: 'rule', key: Date.now(), rule: r })}
              />
            ))}
          </Card>
        </View>
      ) : null}

      {entries.length > 0 ? (
        <View style={{ gap: 8 }}>
          <AppText variant="eyebrow" tone="muted">{t('income.received')}</AppText>
          <Card style={{ padding: 0 }}>
            {entries.slice(0, 50).map((e, i) => (
              <ListRow
                key={e.id}
                first={i === 0}
                title={e.name}
                subtitle={shortDate(e.date)}
                value={formatRM(e.amount)}
                valueTone="positive"
                onPress={() => setSheet({ type: 'entry', key: Date.now(), entry: e })}
              />
            ))}
          </Card>
        </View>
      ) : null}

      {sheet?.type === 'rule' ? (
        <RuleSheet
          key={sheet.key}
          existing={sheet.rule}
          today={today}
          onClose={() => setSheet(null)}
          onSave={async (input) => {
            if (sheet.rule) await ruleOps.update({ ...sheet.rule, ...input });
            else await ruleOps.add(input);
          }}
          onDelete={sheet.rule ? () => confirmRemove('income.ruleDeleteTitle', 'income.ruleDeleteMessage', () => ruleOps.remove(sheet.rule!.id)) : undefined}
        />
      ) : null}
      {sheet?.type === 'entry' ? (
        <EntrySheet
          key={sheet.key}
          existing={sheet.entry}
          today={today}
          onClose={() => setSheet(null)}
          onSave={async (input) => {
            if (sheet.entry) await entryOps.update({ ...sheet.entry, ...input });
            else await entryOps.add(input);
          }}
          onDelete={sheet.entry ? () => confirmRemove('income.entryDeleteTitle', 'income.entryDeleteMessage', () => entryOps.remove(sheet.entry!.id)) : undefined}
        />
      ) : null}
    </Screen>
  );
}
