import { useState } from 'react';
import { View } from 'react-native';
import { RetirementSheet } from '@/features/wealth/RetirementSheet';
import { ListRow } from '@/features/wealth/ListRow';
import { syncRecordClaim } from '@/features/wealth/reliefLink';
import { monthLabel } from '@/domain/dates';
import { formatRM } from '@/domain/money';
import { employeeShare, type RetirementEntry } from '@/domain/retirement';
import { useReliefClaims } from '@/hooks/useReliefClaims';
import { useRetirement } from '@/hooks/useRetirement';
import { useToday } from '@/hooks/useToday';
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

export default function Socso() {
  const { c } = useTheme();
  const today = useToday();
  const year = Number(today.slice(0, 4));
  const { socsoEntries, socso, add, update, remove } = useRetirement(year);
  const claims = useReliefClaims(year);

  const [sheet, setSheet] = useState<{ key: number; entry: RetirementEntry | null } | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalEmployee = socso.socso.employee + socso.eis.employee;
  const totalEmployer = socso.socso.employer + socso.eis.employer;

  async function countTowardTax() {
    setError(null);
    try {
      await syncRecordClaim(claims.data, claims, 'socso', year, socso.yearEmployee);
      setClaimed(true);
    } catch {
      setError(t('common.saveFailed'));
    }
  }

  async function removeEntry(e: RetirementEntry): Promise<boolean> {
    if (!(await confirmDelete(t('retirement.deleteTitle'), t('retirement.deleteMessage'), t('common.delete'), t('common.cancel')))) return false;
    await remove(e.id);
    return true;
  }

  return (
    <Screen>
      <BackButton />
      <AppText variant="title">{t('socso.title')}</AppText>
      <HeroCard style={{ gap: 12 }}>
        <View style={{ gap: 4 }}>
          <AppText variant="eyebrow" color={c.heroSoft}>{t('socso.total')}</AppText>
          <AppText testID="socso-total" variant="kpi" color={c.heroInk}>{formatRM(totalEmployee + totalEmployer)}</AppText>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <AppText variant="small" tone="muted">{t('retirement.scheme.socso')}</AppText>
            <AppText variant="bodyStrong">{t('socso.months', { count: socso.socso.months })}</AppText>
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="small" tone="muted">{t('retirement.scheme.eis')}</AppText>
            <AppText variant="bodyStrong">{t('socso.months', { count: socso.eis.months })}</AppText>
          </View>
        </View>
        <AppText variant="small" tone="muted">
          {t('socso.split', { employee: formatRM(totalEmployee), employer: formatRM(totalEmployer) })}
        </AppText>
      </HeroCard>

      <Button title={t('retirement.add')} onPress={() => setSheet({ key: Date.now(), entry: null })} />

      {socso.yearEmployee > 0 ? (
        <Card style={{ gap: 10 }}>
          <AppText variant="bodyStrong">{t('socso.taxTitle')}</AppText>
          <AppText variant="small" tone="muted">{t('socso.taxHint', { amount: formatRM(socso.yearEmployee), year })}</AppText>
          <Button
            title={t(claimed ? 'epf.taxDone' : 'epf.taxButton')}
            variant="secondary"
            compact
            disabled={claimed}
            onPress={countTowardTax}
          />
        </Card>
      ) : null}
      {error ? <AppText variant="small" tone="negative">{error}</AppText> : null}

      <AppText variant="section">{t('retirement.records')}</AppText>
      {socsoEntries.length === 0 ? (
        <EmptyState icon="people" text={t('socso.empty')} hint={t('socso.emptyHint')} />
      ) : (
        <Card style={{ padding: 0 }}>
          {socsoEntries.map((e, i) => {
            const title = `${t(`retirement.scheme.${e.scheme as 'socso' | 'eis'}`)} · ${monthLabel(e.date.slice(0, 7))}`;
            return (
              <ListRow
                key={e.id}
                first={i === 0}
                title={title}
                accessibilityLabel={`${title} ${formatRM(e.amount)}`}
                subtitle={`${t('retirement.employee')} ${formatRM(employeeShare(e))} · ${t('retirement.employer')} ${formatRM(e.employerShare)}`}
                value={formatRM(e.amount)}
                onPress={() => setSheet({ key: Date.now(), entry: e })}
              />
            );
          })}
        </Card>
      )}

      {sheet ? (
        <RetirementSheet
          key={sheet.key}
          visible
          group="socso"
          existing={sheet.entry}
          onClose={() => setSheet(null)}
          onSave={async (input) => {
            if (sheet.entry) await update({ ...sheet.entry, ...input });
            else await add(input);
            setClaimed(false);
          }}
          onDelete={sheet.entry ? () => removeEntry(sheet.entry!) : undefined}
        />
      ) : null}
    </Screen>
  );
}
