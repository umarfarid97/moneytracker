import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { RetirementSheet } from '@/features/wealth/RetirementSheet';
import { ListRow } from '@/features/wealth/ListRow';
import { syncRecordClaim } from '@/features/wealth/reliefLink';
import { TextField } from '@/features/wealth/TextField';
import { dayMonth, monthLabel } from '@/domain/dates';
import { formatRM, parseRM, parsePercent, senToInput } from '@/domain/money';
import { employeeShare, projectRetirement, suggestedEpf, type RetirementEntry } from '@/domain/retirement';
import { useProfile } from '@/hooks/useProfile';
import { useReliefClaims } from '@/hooks/useReliefClaims';
import { useRetirement } from '@/hooks/useRetirement';
import { useToday } from '@/hooks/useToday';
import { t } from '@/i18n/t';
import { AmountInput } from '@/ui/AmountInput';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { confirmDelete } from '@/ui/confirm';
import { EmptyState } from '@/ui/EmptyState';
import { HeroCard, onHero } from '@/ui/HeroCard';
import { Screen } from '@/ui/Screen';

function Stat({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <AppText variant="small" tone="muted">{label}</AppText>
      <AppText testID={testID} variant="bodyStrong" numberOfLines={1} adjustsFontSizeToFit>{value}</AppText>
    </View>
  );
}

function entryTitle(e: RetirementEntry): string {
  return e.kind === 'contribution' ? `${t('retirement.kind.contribution')} · ${monthLabel(e.date.slice(0, 7))}` : t(`retirement.kind.${e.kind}`);
}

export default function Epf() {
  const today = useToday();
  const year = Number(today.slice(0, 4));
  const { data: profile } = useProfile();
  const { epfEntries, epf, add, update, remove } = useRetirement(year);
  const claims = useReliefClaims(year);

  const [sheet, setSheet] = useState<{ key: number; entry: RetirementEntry | null } | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Retirement view: starts from what the records suggest, and every figure can be changed.
  const latest = epfEntries.find((e) => e.kind === 'contribution');
  const suggested = suggestedEpf(profile.grossMonthly, profile.epfRate);
  const [age, setAge] = useState('');
  const [retireAt, setRetireAt] = useState('60');
  const [dividend, setDividend] = useState('5.5');
  const [monthlyText, setMonthlyText] = useState(() => {
    const m = latest ? latest.amount : suggested.employee + suggested.employer;
    return m > 0 ? senToInput(m) : '';
  });

  const ageN = /^\d{1,3}$/.test(age.trim()) ? Number(age) : null;
  const retireN = /^\d{1,3}$/.test(retireAt.trim()) ? Number(retireAt) : null;
  const dividendN = parsePercent(dividend, 20);
  const monthly = monthlyText.trim() === '' ? 0 : parseRM(monthlyText);
  const projection = useMemo(
    () =>
      ageN !== null && retireN !== null && retireN > ageN && dividendN !== null && monthly !== null
        ? projectRetirement({ balance: epf.balance, monthly, years: retireN - ageN, dividendPct: dividendN })
        : null,
    [ageN, retireN, dividendN, monthly, epf.balance],
  );

  async function countTowardTax() {
    setError(null);
    try {
      await syncRecordClaim(claims.data, claims, 'epf', year, epf.year.employee);
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
      <AppText variant="title">{t('epf.title')}</AppText>
      <HeroCard style={{ gap: 14 }}>
        <View style={{ gap: 4 }}>
          <AppText variant="eyebrow" color={onHero.soft}>{t('epf.balance')}</AppText>
          <AppText testID="epf-balance" variant="kpi" color={onHero.ink}>{formatRM(epf.balance)}</AppText>
        </View>
        <AppText variant="small" tone="muted">{t('epf.thisYear', { year })}</AppText>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Stat label={t('retirement.employee')} value={formatRM(epf.year.employee)} testID="epf-year-employee" />
          <Stat label={t('retirement.employer')} value={formatRM(epf.year.employer)} testID="epf-year-employer" />
          <Stat label={t('retirement.kind.dividend')} value={formatRM(epf.year.dividends)} />
        </View>
      </HeroCard>

      <Button title={t('retirement.add')} onPress={() => setSheet({ key: Date.now(), entry: null })} />

      {epf.year.employee > 0 ? (
        <Card style={{ gap: 10 }}>
          <AppText variant="bodyStrong">{t('epf.taxTitle')}</AppText>
          <AppText variant="small" tone="muted">{t('epf.taxHint', { amount: formatRM(epf.year.employee) })}</AppText>
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

      <Card style={{ gap: 14 }}>
        <AppText variant="section">{t('epf.retirement')}</AppText>
        <AppText variant="small" tone="muted">{t('epf.retirementHint')}</AppText>
        <TextField label={t('epf.age')} value={age} onChange={setAge} numeric decimals={0} maxLength={3} />
        <TextField label={t('epf.retireAt')} value={retireAt} onChange={setRetireAt} numeric decimals={0} maxLength={3} />
        <TextField label={t('epf.dividend')} value={dividend} onChange={setDividend} numeric maxLength={5} />
        <AmountInput label={t('epf.monthly')} value={monthlyText} onChange={setMonthlyText} compact />
        {projection ? (
          <View style={{ gap: 6 }}>
            <AppText variant="small" tone="muted">{t('epf.projected', { age: retireN ?? 0 })}</AppText>
            <AppText testID="epf-projected" variant="kpi">{formatRM(projection.atRetirement)}</AppText>
            <AppText variant="small" tone="muted">
              {t('epf.projectedSplit', { saved: formatRM(projection.contributions), growth: formatRM(projection.growth) })}
            </AppText>
            <AppText testID="epf-income" variant="bodyStrong">
              {t('epf.income', { amount: formatRM(projection.monthlyIncome) })}
            </AppText>
          </View>
        ) : (
          <AppText variant="small" tone="muted">{t('epf.needAge')}</AppText>
        )}
        <AppText variant="small" tone="muted">{t('common.estimate')}</AppText>
      </Card>

      <AppText variant="section">{t('retirement.records')}</AppText>
      {epfEntries.length === 0 ? (
        <EmptyState icon="shield-checkmark" text={t('epf.empty')} hint={t('epf.emptyHint')} />
      ) : (
        <Card style={{ padding: 0 }}>
          {epfEntries.map((e, i) => (
            <ListRow
              key={e.id}
              first={i === 0}
              title={entryTitle(e)}
              accessibilityLabel={`${entryTitle(e)} ${formatRM(e.amount)}`}
              subtitle={
                e.kind === 'contribution'
                  ? `${t('retirement.employee')} ${formatRM(employeeShare(e))} · ${t('retirement.employer')} ${formatRM(e.employerShare)}`
                  : [dayMonth(e.date), e.note].filter(Boolean).join(' · ')
              }
              value={`${e.kind === 'withdrawal' ? '-' : ''}${formatRM(e.amount)}`}
              valueTone={e.kind === 'withdrawal' ? 'negative' : 'text'}
              onPress={() => setSheet({ key: Date.now(), entry: e })}
            />
          ))}
        </Card>
      )}

      {sheet ? (
        <RetirementSheet
          key={sheet.key}
          visible
          group="epf"
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
